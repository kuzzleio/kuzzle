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

import { NormalizedFilter } from 'koncorde';
import { JSONObject } from 'kuzzle-sdk';
import Long from 'long';

import kerror from '../kerror';
import '../types/Global';

import { toKoncordeIndex } from '../util/koncordeCompat';

const errorFatal = kerror.wrap('cluster', 'fatal');

/**
 * Private class aiming at maintaining both the number of a node's subscriptions
 * to a room, and the node's last message ID to detect desyncs.
 */
class RoomSubscriptions {
  private nodeId: string;

  private _subscribers: number;
  
  private _messageId: Long;

  /**
   * @constructor
   * 
   * @param messageId ID of the last message that updated this room
   * @param [subscribers]
   */
  constructor (nodeId: string, messageId: Long, subscribers: number) {
    this.nodeId = nodeId;

    this._subscribers = subscribers;

    // type: Long
    this._messageId = messageId;
  }

  get subscribers () {
    return this._subscribers;
  }

  get messageId () {
    return this._messageId;
  }

  incr (messageId: Long) {
    // may happen when resyncing: ignore older messages
    if (messageId.greaterThan(this._messageId)) {
      this._subscribers++;
      this._messageId = messageId;
    }

    return this._subscribers;
  }

  decr (messageId: Long) {
    // may happen when resyncing: ignore older messages
    if (messageId.greaterThan(this._messageId)) {
      this._subscribers--;
      this._messageId = messageId;
    }

    return this._subscribers;
  }

  serialize (): SerializedRoomSubscriptions {
    return {
      messageId: this._messageId,
      nodeId: this.nodeId,
      subscribers: this._subscribers,
    };
  }
}

export type SerializedRoomSubscriptions = {
  nodeId: string;

  // @todo check this in JSON
  messageId: Long;

  subscribers: number;
}

/**
 * Private class representing a single realtime room state
 */
class RoomState {
  public id: string;

  public index: string;

  public collection: string;
  
  public filters: JSONObject;

  /**
   * List of nodes having subscriptions on this room
   * 
   * Map<nodeId, RoomSubscriptions>
   */
  public nodes = new Map<string, RoomSubscriptions>();
  
  constructor (roomId: string, index: string, collection: string, filters: JSONObject) {
    this.id = roomId;
    this.index = index;
    this.collection = collection;
    this.filters = filters;
  }

  /**
   * Adds a new node to the state
   * 
   * @param nodeId
   * @param messageId
   * @param [subscribers] -- number of subscribers
   */
  addNode (nodeId: string, messageId: Long, subscribers: number) {
    if (this.nodes.has(nodeId)) {
      throw errorFatal.get('desync', `cannot add node ${nodeId} to room ${this.id} (duplicate node)`);
    }

    this.nodes.set(nodeId, new RoomSubscriptions(nodeId, messageId, subscribers));
  }

  removeNode (nodeId: string) {
    this.nodes.delete(nodeId);
  }

  incr (nodeId: string, messageId: Long) {
    const node = this.nodes.get(nodeId);

    if (! node) {
      // die
      throw errorFatal.get('desync', `cannot add subscription to room ${this.id} (unknown node ${nodeId})`);
    }

    node.incr(messageId);
  }

  decr (nodeId: string, messageId: Long) {
    const node = this.nodes.get(nodeId);

    if (! node) {
      // die
      throw errorFatal.get('desync', `cannot remove subscription from room ${this.id} (unknown node ${nodeId})`);
    }

    if (node.decr(messageId) < 0) {
      throw errorFatal.get('desync', `node ${nodeId} has a negative subscribers count on room ${this.id}`);
    }
  }

  hasNodes (): boolean {
    return this.nodes.size > 0;
  }

  countSubscriptions (): number {
    let result = 0;

    for (const nodeSubs of this.nodes.values()) {
      result += nodeSubs.subscribers;
    }

    return result;
  }

  serialize (): SerializedRoomState {
    const result: SerializedRoomState = {
      collection: this.collection,
      filters: JSON.stringify(this.filters),
      index: this.index,
      nodes: [],
      roomId: this.id,
    };

    for (const nodeSubs of this.nodes.values()) {
      result.nodes.push(nodeSubs.serialize());
    }

    return result;
  }
}

export type SerializedRoomState = {
  collection: string;

  filters: string;
  
  index: string;

  nodes: SerializedRoomSubscriptions[];

  roomId: string;
}

/**
 * Class maintaining the complete cluster state
 */
export default class State {
  /**
   * State of realtime rooms.
   *
   * Each room state contains the node IDs subscribing to the room. 
   * 
   * Map<roomId, RoomState>
   */
  private realtime = new Map<string, RoomState>();

  /**
   * State of authentication strategies
   * 
   * Map<strategyName, strategyDefinition>
   */
  private strategies = new Map<string, JSONObject>();

  /**
   * Adds a new realtime room to the state
   * 
   * @param roomId
   * @param index
   * @param collection
   * @param filters Precomputed Koncorde filters
   * @param node
   */
  addRealtimeRoom (
    roomId: string, 
    index: string, 
    collection: string, 
    filters: JSONObject, 
    node: SerializedRoomSubscriptions
  ) {
    let room = this.realtime.get(roomId);

    if (! room) {
      room = new RoomState(roomId, index, collection, filters);
      this.realtime.set(roomId, room);
    }

    const kindex = toKoncordeIndex(index, collection);

    if (! global.kuzzle.koncorde.hasFilterId(roomId, kindex)) {
      global.kuzzle.koncorde.store(new NormalizedFilter(filters, roomId, kindex));
    }

    room.addNode(node.nodeId, node.messageId, node.subscribers);
  }

  /**
   * Retrieves a room in the same format than Koncorde.normalize
   *
   * @param roomId
   */
  getNormalizedFilters (roomId: string): NormalizedFilter | null {
    const room = this.realtime.get(roomId);

    if (! room) {
      return null;
    }

    return new NormalizedFilter(
      room.filters,
      roomId,
      toKoncordeIndex(room.index, room.collection));
  }

  /**
   * Removes a room in the full state, for a given node.
   *
   * @param roomId
   * @param nodeId
   */
  removeRealtimeRoom (roomId: string, nodeId: string) {
    const room = this.realtime.get(roomId);

    /**
     * If a local room gets deleted, there aren't sync data about it
     * @todo investigate this
     */
    if (! room) {
      return;
    }

    room.removeNode(nodeId);

    if (! room.hasNodes()) {
      this.realtime.delete(roomId);

      global.kuzzle.koncorde.remove(
        roomId,
        toKoncordeIndex(room.index, room.collection));
    }
  }

  countRealtimeSubscriptions (roomId: string): number {
    const room = this.realtime.get(roomId);

    if (! room) {
      return 0;
    }

    return room.countSubscriptions();
  }

  listRealtimeRooms () {
    const list: {
      [index: string]: {
        [collection: string]: {
          [roomId: string]: number
        }
      }
    } = {};

    for (const room of this.realtime.values()) {
      if (!list[room.index]) {
        list[room.index] = {};
      }

      if (!list[room.index][room.collection]) {
        list[room.index][room.collection] = {};
      }

      list[room.index][room.collection][room.id] = room.countSubscriptions();
    }

    return list;
  }

  addRealtimeSubscription (roomId: string, nodeId: string, messageId: Long) {
    const room = this.realtime.get(roomId);

    if (! room) {
      throw errorFatal.get('desync', `cannot add subscription to room ${roomId} (room doesn't exist)`);
    }

    room.incr(nodeId, messageId);
  }

  removeRealtimeSubscription (roomId: string, nodeId: string, messageId: Long) {
    const room = this.realtime.get(roomId);

    if (! room) {
      throw errorFatal.get('desync', `cannot remove subscription from room ${roomId} (room doesn't exist)`);
    }

    room.decr(nodeId, messageId);
  }

  /**
   * Removes a node from the full state
   *
   * @param  nodeId
   */
  removeNode (nodeId: string) {
    for (const roomId of this.realtime.keys()) {
      this.removeRealtimeRoom(roomId, nodeId);
    }
  }

  /**
   * Adds a new dynamic strategy to the full state
   *
   */
  addAuthStrategy (strategyObject: JSONObject) {
    this.strategies.set(strategyObject.strategyName, strategyObject);
  }

  removeAuthStrategy (strategyName: string) {
    this.strategies.delete(strategyName);
  }

  serialize () {
    return {
      authStrategies: Array.from(this.strategies.values()),
      rooms: Array.from(this.realtime.values()).map(room => room.serialize()),
    };
  }

  /**
   * Initializes itself from a full state description
   *
   * /!\ Modifies Kuzzle's RAM cache: loading a full cache also load data into
   * Koncorde. This is necessary to allow to detect changes to filters that
   * could otherwise not be known to this node (e.g. if only 1 subscription
   * exists and made on another node)
   *
   * @param serialized POJO object of a full realtime state
   */
  loadFullState (serialized: SerializedState) {
    if (serialized.rooms) {
      for (const state of serialized.rooms) {
        for (const node of state.nodes) {
          this.addRealtimeRoom(
            state.roomId,
            state.index,
            state.collection,
            JSON.parse(state.filters),
            node);
        }
      }
    }

    if (serialized.authStrategies) {
      for (const state of serialized.authStrategies) {
        global.kuzzle.pluginsManager.registerStrategy(
          state.pluginName,
          state.strategyName,
          state.strategy);

        this.addAuthStrategy(state);
      }
    }
  }
}

export type SerializedState = {
  authStrategies: JSONObject[];

  rooms: SerializedRoomState[];
};

module.exports = State;
