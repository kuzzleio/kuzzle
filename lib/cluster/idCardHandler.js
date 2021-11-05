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

'use strict';

const { generateRandomName } = require('../util/name-generator');
const { Worker } = require('worker_threads');
const Bluebird = require('bluebird');

const REDIS_PREFIX = '{cluster/node}/';
const REDIS_ID_CARDS_INDEX = REDIS_PREFIX + 'id-cards-index';

/**
 * @typedef {IdCard}
 */
class IdCard {
  /**
   * @param {Object} obj - contains the ID card description
   * @param {string} obj.id - node identifier
   * @param {string} obj.ip - node IP address
   * @param {Number} obj.birthdate - node creation timestamp
   * @param {Array.<string>} obj.topology - node's known topology
   */
  constructor (obj) {
    this.id = obj.id;
    this.ip = obj.ip;
    this.birthdate = obj.birthdate;
    this.topology = new Set(obj.topology);
  }

  serialize () {
    return JSON.stringify({
      birthdate: this.birthdate,
      id: this.id,
      ip: this.ip,
      topology: Array.from(this.topology),
    });
  }

  static unserialize (value) {
    return new IdCard(JSON.parse(value));
  }
}

/**
 * Handles the ID Key stored in Redis, holding node information
 */
class ClusterIdCardHandler {
  constructor (node) {
    this.node = node;
    this.idCard = null;
    this.ip = node.ip;
    this.refreshDelay = node.heartbeatDelay;
    this.refreshWorker = null;
    this.nodeId = null;
    this.nodeIdKey = null;

    // Flag to prevent updating the id card if it has been disposed.
    // Prevents race condition if a topology update occurs at the same time as
    // the id card is been disposed because the node is evicting itself from the
    // cluster
    this.disposed = false;

    // Add a delay for key expiration to make sure the node have the time to
    // refresh it
    this.refreshMultiplier = 4;
  }

  /**
   * Generates and reserves a unique ID for this node instance.
   * Makes sure that the ID is not already taken by another node instance.
   *
   * @return {void}
   */
  async createIdCard () {
    let reserved;

    do {
      this.nodeId = generateRandomName('knode');
      this.nodeIdKey = `${REDIS_PREFIX}${this.nodeId}`;
      this.idCard = new IdCard({
        birthdate: Date.now(),
        id: this.nodeId,
        ip: this.ip,
        topology: [],
      });

      reserved = await this._save({ creation: true });
    } while (!reserved);

    await this.addIdCardToIndex();

    this.refreshWorker = this._constructWorker(`${__dirname}/workers/IDCardRenewer.js`);
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
  }

  // Used to Mock the creation of a worker for the tests
  _constructWorker (path) {
    return new Worker(path);
  }

  async dispose () {
    this.disposed = true;
    if (this.refreshWorker) {
      this.refreshWorker.postMessage({action: 'dispose'});
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
  async getRemoteIdCards () {
    const idCards = [];

    let keys = await global.kuzzle.ask(
      'core:cache:internal:execute',
      'smembers',
      REDIS_ID_CARDS_INDEX);

    keys = keys.filter(nodeIdKey => nodeIdKey !== this.nodeIdKey);

    if (keys.length === 0) {
      return idCards;
    }

    const values = await global.kuzzle.ask('core:cache:internal:mget', keys);
    const expiredIdCards = [];

    for (let i = 0; i < keys.length; i++) {
      // filter keys that might have expired between the key search and their
      // values retrieval
      if (values[i] !== null) {
        idCards.push(IdCard.unserialize(values[i]));
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
  async addNode (id) {
    if (this.disposed || this.idCard.topology.has(id)) {
      return;
    }

    this.idCard.topology.add(id);

    await this._save();
  }

  /**
   * Removes a remote node IdCard from the node known topology
   */
  async removeNode (id) {
    if (!this.disposed && this.idCard.topology.delete(id)) {
      await this._save();
    }
  }

  /**
   * Store the key under which this node ID Card is stored inside the set.
   *
   * This set is an index to retrieve ID Cards faster.
   */
  async addIdCardToIndex () {
    await global.kuzzle.ask(
      'core:cache:internal:execute',
      'sadd',
      REDIS_ID_CARDS_INDEX, this.nodeIdKey);
  }

  /**
   * Saves the local node IdCard into Redis
   */
  _save ({ creation } = { creation: false }) {
    return global.kuzzle.ask(
      'core:cache:internal:store',
      this.nodeIdKey,
      this.idCard.serialize(),
      { onlyIfNew: creation, ttl: this.refreshDelay * this.refreshMultiplier });
  }
}

module.exports = { ClusterIdCardHandler, IdCard };
