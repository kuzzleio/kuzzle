/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { generateRandomName } from '../util/name-generator';
import { Worker as WorkerThread } from 'worker_threads';
import Bluebird from 'bluebird';

import '../types';

const REDIS_PREFIX = '{cluster/node}/';
const REDIS_ID_CARDS_INDEX = REDIS_PREFIX + 'id-cards-index';

export type SerializedIdCard = {
  id: string;
  ip: string;
  birthdate: number;
  topology: string[];
}

export class IdCard {
  /**
   * Node unique identifier
   *
   * @example
   *
   * knode-pensive-einstein-844221
   */
  private id: string;

  /**
   * Node IP address
   */
  private ip: string;

  /**
   * Node creation timestamp
   */
  private birthdate: number;

  /**
   * Node known topology composed of node IDs
   *
   * Set<node-id>
   */
  public topology: Set<string>;

  constructor ({ id, ip, birthdate, topology }: SerializedIdCard) {
    this.id = id;
    this.ip = ip;
    this.birthdate = birthdate;
    this.topology = new Set(topology);
  }

  serialize (): SerializedIdCard {
    return {
      birthdate: this.birthdate,
      id: this.id,
      ip: this.ip,
      topology: Array.from(this.topology),
    };
  }

  static unserialize (serialized: SerializedIdCard): IdCard {
    return new IdCard(serialized);
  }
}

/**
 * Handles the ID Key stored in Redis, holding node information
 */
export class ClusterIdCardHandler {
  /**
   * Node instance. Represents the local node.
   */
  private node: any;

  /**
   * Local node ID Card
   */
  private idCard: IdCard = null;

  /**
   * Local node IP address
   */
  private ip: string;

  /**
   * Delay for refreshing the ID Card. The heartbeat timer is run on this delay
   * and the node ID Card should be available on Redis otherwise it will be evicted.
   */
  private refreshDelay: number;

  /**
   * Multiplier used to ensure the node has enough time to refresh it's ID Card
   * before the ID Card refresh delay
   */
  private refreshMultiplier = 2;

  /**
   * Worker thread in charge of refreshing the ID Card once the node has started
   */
  private refreshWorker: WorkerThread = null;

  /**
   * Hold the timer in charge of refreshing the ID Card before the worker starts
   */
  private refreshTimer: any = null;

  /**
   * Local node ID
   */
  private nodeId: string = null;

  /**
   * Local node Redis key
   */
  private nodeIdKey: string = null;

  /**
   * Flag to prevent updating the id card if it has been disposed.
   * Prevents race condition if a topology update occurs at the same time as
   * the id card is been disposed because the node is evicting itself from the
   * cluster
   */
  private disposed = false;

  constructor (node: any) {
    this.node = node;
    this.ip = node.ip;
    this.refreshDelay = node.heartbeatDelay;
  }

  /**
   * Generates and reserves a unique ID for this node instance.
   * Makes sure that the ID is not already taken by another node instance.
   */
  async createIdCard (): Promise<void> {
    let reserved = false;

    do {
      this.nodeId = generateRandomName('knode');
      this.nodeIdKey = `${REDIS_PREFIX}${this.nodeId}`;
      this.idCard = new IdCard({
        birthdate: Date.now(),
        id: this.nodeId,
        ip: this.ip,
        topology: [],
      });

      reserved = await this.save({ creation: true });
    } while (! reserved);

    await this.addIdCardToIndex();

    this.refreshWorker = this.constructWorker(`${__dirname}/workers/IDCardRenewer.js`);
    this.refreshWorker.unref();

    this.refreshWorker.on('message', async message => {
      if (message.error) {
        await this.node.evictSelf(message.error);
      }
    });

    // Transfer informations to the worker
    this.refreshWorker.postMessage({
      action: 'start', // start the worker
      kuzzle: {
        config: global.kuzzle.config,
        id: global.kuzzle.id,
      },
      nodeIdKey: this.nodeIdKey,
      // Used to configure a redis the same way as the Cache Engine does
      redis: {
        config: global.kuzzle.config.services.internalCache,
        name: 'internal_adapter',
      },
      refreshDelay: this.refreshDelay,
      refreshMultiplier: this.refreshMultiplier,
    });

    this.startTemporaryRefresh();
  }

  /**
   * Helper method to mock worker instantiation in unit tests
   */
  private constructWorker (path: string) {
    return new WorkerThread(path);
  }

  /**
   * Start refreshing the ID Card before the worker starts to ensure the ID Card
   * is refreshed.
   *
   * Once the worker starts, this timer will be stopped.
   */
  private startTemporaryRefresh () {
    this.refreshTimer = setInterval(async () => {
      try {
        await this.save();
      }
      catch (error) {
        global.kuzzle.log.error(`An error occurred while refreshing the ID card during WorkerThread startup: ${error}`);
      }
    }, this.refreshDelay * this.refreshMultiplier);

    this.refreshWorker.on('message', ({ initialized }) => {
      if (initialized) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
      }
    });
  }

  async dispose (): Promise<void> {
    this.disposed = true;

    if (this.refreshWorker) {
      this.refreshWorker.postMessage({ action: 'dispose' });
    }
  }

  /**
   * Retrieves the ID cards from other nodes
   *
   * Each node store it's ID Card under a specific key name. When Redis database
   * is growing, searching for those keys can be quite expensive and can slow down
   * the handshake process.
   *
   * We are storing a set containing ID Card's keys under a set so when a new node
   * is started, it can directly get the other nodes ID Cards with SMEMBERS and
   * then MGET instead of using SCAN.
   *
   * When a new node retrieve the ID Card's keys from the set, it try to get them
   * with MGET, those who cannot be retrieved are expired ID Cards so the node update
   * the set accordingly.
   *
   * @return {Array.<IdCard>}
   */
  async getRemoteIdCards (): Promise<IdCard[]> {
    const idCards: IdCard[] = [];

    let keys: string[] = await global.kuzzle.ask(
      'core:cache:internal:execute',
      'smembers',
      REDIS_ID_CARDS_INDEX);

    keys = keys.filter(nodeIdKey => nodeIdKey !== this.nodeIdKey);

    if (keys.length === 0) {
      return idCards;
    }

    const rawIdCards: string[] = await global.kuzzle.ask('core:cache:internal:mget', keys);
    const expiredIdCards: string[] = [];

    for (let i = 0; i < keys.length; i++) {
      // filter keys that might have expired between the key search and their
      // values retrieval
      if (rawIdCards[i] !== null) {
        idCards.push(IdCard.unserialize(JSON.parse(rawIdCards[i])));
      }
      else {
        expiredIdCards.push(keys[i]);
      }
    }

    // Clean expired ID Card's keys in the index
    await Bluebird.map(expiredIdCards, idCardKey => {
      return global.kuzzle.ask(
        'core:cache:internal:execute',
        'srem',
        REDIS_ID_CARDS_INDEX,
        idCardKey);
    });

    return idCards;
  }

  /**
   * Adds a remote node IdCard to the node known topology
   */
  async addNode (id: string): Promise<void> {
    if (this.disposed || this.idCard.topology.has(id)) {
      return;
    }

    this.idCard.topology.add(id);

    await this.save();
  }

  /**
   * Removes a remote node IdCard from the node known topology
   */
  async removeNode (id: string): Promise<void> {
    if (! this.disposed && this.idCard.topology.delete(id)) {
      await this.save();
    }
  }

  /**
   * Store the key under which this node ID Card is stored inside the set.
   *
   * This set is an index to retrieve ID Cards faster.
   */
  async addIdCardToIndex (): Promise<void> {
    await global.kuzzle.ask(
      'core:cache:internal:execute',
      'sadd',
      REDIS_ID_CARDS_INDEX, this.nodeIdKey);
  }

  /**
   * Saves the local node IdCard into Redis
   *
   * @returns True if the key was set
   */
  private async save ({ creation } = { creation: false }): Promise<boolean> {
    if (! this.idCard) {
      return false;
    }

    return await global.kuzzle.ask(
      'core:cache:internal:store',
      this.nodeIdKey,
      JSON.stringify(this.idCard.serialize()),
      { onlyIfNew: creation, ttl: this.refreshDelay * this.refreshMultiplier });
  }
}
