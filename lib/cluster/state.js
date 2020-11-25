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

const kerror = require('../kerror').wrap('cluster', 'fatal');

// Private class aiming at maintaining both the number of a node's subscriptions
// to a room, and the node's last message ID to detect desyncs.
class RoomSubscriptions {
  /**
   * @constructor
   * @param  {Number} messageId     -- ID of the last message that updated this
   *                                   room
   * @param  {Number} [subscribers] -- Rooms get created only when someone first
   *                                   subscribes to it, so there is at least 1
   *                                   subscriber
   */
  constructor (messageId, subscribers = 1) {
    this._subscribers = subscribers;
    // type: Long
    this._lastMessageId = messageId;
  }

  get subscribers () {
    return this._subscribers;
  }

  get lastMessageId () {
    return this._lastMessageId;
  }

  incr (messageId) {
    // may happen when resyncing: ignore older messages
    if (messageId > this._lastMessageId) {
      this._subscribers++;
      this._lastMessageId = messageId;
    }

    return this._subscribers;
  }

  decr (messageId) {
    // may happen when resyncing: ignore older messages
    if (messageId > this._lastMessageId) {
      this._subscribers--;
      this._lastMessageId = messageId;
    }

    return this._subscribers;
  }

  serialize () {
    return {
      lastMessageId: this._lastMessageId,
      subscribers: this._subscribers,
    };
  }
}

// Private class representing a single realtime room state
class RoomState {
  constructor (roomId, index, collection, filters) {
    this.id = roomId;
    this.index = index;
    this.collection = collection;
    this.filters = filters;
    this.nodes = new Map();
  }

  /**
   * Adds a new node to the state
   * @param {String} nodeId
   * @param {Number} messageId
   * @param {Number} [subscribers] -- number of subscribers
   */
  addNode (nodeId, messageId, subscribers) {
    if (this.nodes.has(nodeId)) {
      throw kerror.get('desync', `cannot add node ${nodeId} to room ${this.id} (duplicate node)`);
    }

    this.nodes.set(nodeId, new RoomSubscriptions(messageId, subscribers));
  }

  removeNode (nodeId) {
    if (!this.nodes.has(nodeId)) {
      throw kerror.get('desync', `cannot remove node ${nodeId} from room ${this.id} (node doesn't exist)`);
    }

    this.nodes.delete(nodeId);
  }

  incr (nodeId, messageId) {
    const node = this.nodes.get(nodeId);

    if (!node) {
      // die
      throw kerror.get('desync', `cannot add subscription to room ${this.id} (unknown node ${nodeId})`);
    }

    node.incr(messageId);
  }

  decr (nodeId, messageId) {
    const node = this.nodes.get(nodeId);

    if (!node) {
      // die
      throw kerror.get('desync', `cannot remove subscription from room ${this.id} (unknown node ${nodeId})`);
    }

    if (node.decr(messageId) < 0) {
      throw kerror.get('desync', `node ${nodeId} has a negative subscribers count on room ${this.id}`);
    }
  }

  hasNodes () {
    return this.nodes.size > 0;
  }

  countSubscriptions () {
    let result = 0;

    for (const nodeSubs of this.nodes.values()) {
      result += nodeSubs.subscribers;
    }

    return result;
  }

  serialize () {
    const result = {
      collection: this.collection,
      filters: JSON.stringify(this.filters),
      index: this.index,
      nodes: {},
    };

    for (const [nodeId, nodeSubs] of this.nodes) {
      result.nodes[nodeId] = nodeSubs.serialize();
    }

    return result;
  }
}

// Object maintaining the complete cluster state
class State {
  constructor (kuzzle) {
    this.kuzzle = kuzzle;

    this.realtime = new Map();
  }

  /**
   * Adds a new realtime room to the state
   * @param {string} roomId
   * @param {string} index
   * @param {string} collection
   * @param {Object} filters       -- precomputed Koncorde filters
   * @param {{nodeId: string, subscribers: Number, lastMessageId: Long}} node
   * @returns {void}
   */
  addRealtimeRoom (roomId, index, collection, filters, node) {
    let room = this.realtime.get(roomId);

    if (!room) {
      room = new RoomState(roomId, index, collection, filters);
      this.realtime.set(roomId, room);
    }

    if (!this.kuzzle.koncorde.has(roomId)) {
      this.kuzzle.koncorde.store({
        collection,
        id: roomId,
        index,
        normalized: filters,
      });
    }

    room.addNode(node.nodeId, node.lastMessageId, node.subscribers);
  }

  getRealtimeRoom (roomId) {
    return this.realtime.get(roomId);
  }

  /**
   * Removes a room in the full state, for a given node.
   *
   * @param  {string} roomId
   * @param  {string} nodeId
   * @return {boolean} true: room deleted for all nodes, false: at least 1 other
   *                         node still has subscribers on it
   */
  removeRealtimeRoom (roomId, nodeId) {
    const room = this.realtime.get(roomId);

    if (!room) {
      throw kerror.get('desync', `cannot remove room ${roomId} (room doesn't exist)`);
    }

    room.removeNode(nodeId);

    if (!room.hasNodes()) {
      this.realtime.delete(roomId);
      this.kuzzle.koncorde.remove(roomId);
      return true;
    }

    return false;
  }

  countRealtimeSubscriptions (roomId) {
    const room = this.realtime.get(roomId);

    if (!room) {
      return 0;
    }

    return room.countSubscriptions();
  }

  addRealtimeSubscription (roomId, nodeId, messageId) {
    const room = this.realtime.get(roomId);

    if (!room) {
      throw kerror.get('desync', `cannot add subscription to room ${roomId} (room doesn't exist)`);
    }

    room.incr(nodeId, messageId);
  }

  removeRealtimeSubscription (roomId, nodeId, messageId) {
    const room = this.realtime.get(roomId);

    if (!room) {
      throw kerror.get('desync', `cannot remove subscription from room ${roomId} (room doesn't exist)`);
    }

    room.decr(nodeId, messageId);
  }

  serialize () {
    const result = {};

    for (const [roomId, roomState] of this.realtime) {
      result[roomId] = roomState.serialize();
    }

    return result;
  }

  /**
   * Initializes itself from a full state description
   *
   * /!\ Modifies Kuzzle's RAM cache: loading a full cache also load data into
   * Koncorde. This is necessary to allow to detect changes to filters that
   * could otherwise not be known to this node (e.g. if only 1 subscription
   * exists and made on another node)
   *
   * @param {Object} serialized POJO object of a full realtime state
   * @returns {void}
   */
  loadFullState (serialized) {
    this.realtime.clear();

    if (!serialized.rooms) {
      return;
    }

    for (const state of serialized.rooms) {
      for (const node of state.nodes) {
        this.addRealtimeRoom(
          state.roomId,
          state.index,
          state.collection,
          state.filters,
          node);
      }
    }
  }
}

module.exports = State;
