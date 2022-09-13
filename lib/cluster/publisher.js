/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
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

"use strict";

const { Publisher } = require("zeromq");
const protobuf = require("protobufjs");
const Long = require("long");
const Bluebird = require("bluebird");

const STATE = Object.freeze({
  READY: 1,
  SENDING: 2,
});

// Handles messages publication to other nodes
class ClusterPublisher {
  /**
   * @constructor
   * @param {ClusterNode} node
   */
  constructor(node) {
    this.node = node;
    this.lastMessageId = new Long(0, 0, true);
    this.socket = null;
    this.protoroot = null;

    // Only one call to socket.send can be performed at any given time, and it
    // must be awaited before another send is launched.
    // Since cluster syncs are triggered on events emitted by Kuzzle, and since
    // those events aren't awaitable, many send requests can be requested
    // before a single one has time to finish. We need to handle that here,
    // by bufferizing requests to send
    this.state = STATE.READY;
    this.buffer = [];
  }

  async init() {
    this.socket = new Publisher();
    await this.socket.bind(`tcp://*:${this.node.config.ports.sync}`);

    this.protoroot = await protobuf.load(`${__dirname}/protobuf/sync.proto`);
  }

  /**
   * Publishes an event telling them that this node has created a new room
   *
   * @param {NormalizedFilter} normalized - Obtained with Koncorde.normalize()
   * @return {Long} ID of the message sent to other nodes
   */
  sendNewRealtimeRoom(normalized) {
    const payload = {
      filter: JSON.stringify(normalized.filter),
      id: normalized.id,
      index: normalized.index,
    };

    return this.send("NewRealtimeRoom", payload);
  }

  /**
   * Publishes an event telling telling them that this node
   * no longer has subscribers on the provided realtime room.
   *
   * @param  {string} roomId
   * @return {Long} ID of the message sent to other nodes
   */
  sendRemoveRealtimeRoom(roomId) {
    return this.send("RemoveRealtimeRoom", { roomId });
  }

  /**
   * Publishes an event telling that a room has one less subscriber
   * @param  {string} roomId
   * @return {Long} ID of the message sent to other nodes
   */
  sendUnsubscription(roomId) {
    return this.send("Unsubscription", { roomId });
  }

  /**
   * Publishes an event telling that a new subscription has been made
   * made to an existing room
   *
   * @param  {string} roomId
   * @return {Long} Id of the message sent to other nodes
   */
  sendSubscription(roomId) {
    return this.send("Subscription", { roomId });
  }

  /**
   * Publishes an event telling that a document notification must be
   * propagated
   *
   * @param  {Array.<string>} rooms - Koncorde rooms
   * @param  {DocumentNotification} notification
   * @return {Long} Id of the message sent to other nodes
   */
  sendDocumentNotification(rooms, notification) {
    return this.send("DocumentNotification", {
      action: notification.action,
      collection: notification.collection,
      controller: notification.controller,
      index: notification.index,
      protocol: notification.protocol,
      requestId: notification.requestId,
      result: JSON.stringify(notification.result),
      rooms,
      scope: notification.scope,
      status: notification.status,
      timestamp: notification.timestamp,
      volatile: JSON.stringify(notification.volatile),
    });
  }

  /**
   * Publishes an event telling that a user notification must be
   * propagated
   *
   * @param  {string} room - Koncorde room
   * @param  {UserNotification} notification
   * @return {Long} Id of the message sent to other nodes
   */
  sendUserNotification(room, notification) {
    return this.send("UserNotification", {
      action: notification.action,
      collection: notification.collection,
      controller: notification.controller,
      index: notification.index,
      protocol: notification.protocol,
      result: JSON.stringify(notification.result),
      room,
      status: notification.status,
      timestamp: notification.timestamp,
      user: notification.user,
      volatile: JSON.stringify(notification.volatile),
    });
  }

  /**
   * Publishes an event telling that a new authentication strategy has been
   * dynamically added
   *
   * @param {string} strategyName
   * @param {string} pluginName
   * @param {Object} strategy
   * @return {Long} Id of the message sent to other nodes
   */
  sendNewAuthStrategy(strategyName, pluginName, strategy) {
    return this.send("NewAuthStrategy", {
      pluginName,
      strategy,
      strategyName,
    });
  }

  /**
   * Publishes an event telling that a new authentication strategy has been
   * dynamically added
   *
   * @param {string} strategyName
   * @param {string} pluginName
   * @param {Object} strategyObject
   * @return {Long} Id of the message sent to other nodes
   */
  sendRemoveAuthStrategy(strategyName, pluginName) {
    return this.send("RemoveAuthStrategy", {
      pluginName,
      strategyName,
    });
  }

  /**
   * Publishes an event telling other nodes to create an info dump
   *
   * @param  {string} suffix - dump directory suffix name
   * @returns {Long} ID of the message sent
   */
  sendDumpRequest(suffix) {
    return this.send("DumpRequest", { suffix });
  }

  /**
   * Publishes an event about a new index being added
   *
   * @param  {storeScopeEnum} scope
   * @param  {string} index
   * @returns {Long} ID of the message sent
   */
  sendAddIndex(scope, index) {
    return this.send("AddIndex", { index, scope });
  }

  /**
   * Publishes an event about a new collection being added
   *
   * @param  {storeScopeEnum} scope
   * @param  {string} index
   * @param  {string} collection
   * @returns {Long} ID of the message sent
   */
  sendAddCollection(scope, index, collection) {
    return this.send("AddCollection", { collection, index, scope });
  }

  /**
   * Publishes an event about indexes been removed
   *
   * @param  {storeScopeEnum} scope
   * @param  {Array.<string>} indexes
   * @returns {Long} ID of the message sent
   */
  sendRemoveIndexes(scope, indexes) {
    return this.send("RemoveIndexes", { indexes, scope });
  }

  /**
   * Publishes an event about a collection been removed
   *
   * @param  {storeScopeEnum} scope
   * @param  {string} index
   * @param  {string} collection
   * @returns {Long} ID of the message sent
   */
  sendRemoveCollection(scope, index, collection) {
    return this.send("RemoveCollection", { collection, index, scope });
  }

  /**
   * Publishes an event about a cluster-wide event emission
   *
   * @param  {string} event name
   * @param  {Object} payload - event payload
   * @returns {Long} ID of the message sent
   */
  sendClusterWideEvent(event, payload) {
    return this.send("ClusterWideEvent", {
      event,
      payload: JSON.stringify(payload),
    });
  }

  /**
   * Publishes an event about shutdown
   *
   * @param  {Object} nodeId - node ID
   *
   * @returns {Long} ID of the message sent
   */
  sendNodeShutdown(nodeId) {
    return this.send("NodeShutdown", { nodeId });
  }

  /**
   * Publishes an event about the node being in debug mode
   * @param {bool} evictionPrevented
   * 
   * @returns {Long} ID of the message sent
   */
  sendNodePreventEviction(evictionPrevented) {
    return this.send("NodePreventEviction", { evictionPrevented });
  }

  /**
   * Publishes an event about a node being evicted
   *
   * @param  {string} evictor node ID of the evictor
   * @param  {Object} nodeId - node ID of the node being evicted
   * @param  {Object} reason - reason of the eviction
   *
   * @returns {Long} ID of the message sent
   */
  sendNodeEvicted(evictor, nodeId, reason) {
    return this.send("NodeEvicted", { evictor, nodeId, reason });
  }

  /**
   * Publishes an event about heartbeat
   *
   * @param  {string} address node sync address
   *
   * @returns {Long} ID of the message sent
   */
  sendHeartbeat(address) {
    return this.send("Heartbeat", { address });
  }

  /**
   * Broadcasts a sync message. Topic must match a protobuf type name.
   * Returns immediately, but the message to be sent migh be bufferized and send
   * later.
   *
   * @param  {String} topic name
   * @param  {Object} data
   * @returns {Long} ID of the message sent
   * @throws If the topic's protobuf type cannot be found
   */
  send(topic, data) {
    if (this.socket === null) {
      return Long.NEG_ONE;
    }

    this.lastMessageId = this.lastMessageId.add(1);

    const payload = Object.assign({ messageId: this.lastMessageId }, data);
    const type = this.protoroot.lookupType(topic);
    const buffer = type.encode(type.create(payload)).finish();

    // DO NOT AWAIT: bufferSend is built to bufferize payloads to be sent, and
    // it makes sure that they are sent in order and serially (0mq publisher
    // sockets can only send 1 message at a time, otherwise it throws with a
    // EAGAIN error)
    // Awaiting this method has no practical use. If you DO want to await it
    // (don't), then you have to first make a local copy of this.lastMessageId
    // to make sure that the value returned to the caller has not been
    // increased by other calls
    this.bufferSend(topic, buffer);

    return this.lastMessageId;
  }

  /**
   * Sends the provided message, and then sends all pending ones waiting in
   * the buffer, in order
   *
   * @param  {string} topic
   * @param  {Buffer} data
   * @return {void}
   */
  async bufferSend(topic, data) {
    this.buffer.push({ data, topic });

    if (this.state === STATE.SENDING) {
      return;
    }

    this.state = STATE.SENDING;

    do {
      const _buffer = this.buffer;
      this.buffer = [];

      for (let i = 0; i < _buffer.length; i++) {
        const payload = _buffer[i];
        // This method will never return a rejected promise
        // http://zeromq.github.io/zeromq.js/classes/publisher.html#send
        await this.socket.send([payload.topic, payload.data]);
      }
    } while (this.buffer.length > 0);

    this.state = STATE.READY;
  }

  async dispose() {
    // waits for the buffer to be empty before closing
    while (this.state !== STATE.READY) {
      await Bluebird.delay(100);
    }

    if (this.socket !== null) {
      this.socket.close();
      this.socket = null;
    }
  }
}

module.exports = ClusterPublisher;
