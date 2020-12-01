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

const { Publisher } = require('zeromq');
const protobuf = require('protobufjs');
const Long = require('long');

// Handles messages publication to other nodes

class ClusterPublisher {
  /**
   * @constructor
   * @param {ClusterNode} node
   */
  constructor (node) {
    this.kuzzle = node.kuzzle;
    this.node = node;
    this.lastMessageId = new Long(0, 0, true);
    this.socket = null;
    this.protoroot = null;
  }

  async init () {
    this.socket = new Publisher();
    await this.socket.bind(`tcp://*:${this.node.config.ports.sync}`);

    this.protoroot = await protobuf.load(`${__dirname}/protobuf/sync.proto`);
  }

  /**
   * Publishes an event telling them that this node has created a new room
   *
   * @param {string} roomId ID of the created room
   * @param {string} index
   * @param {string} collection
   * @param {Object} Normalized filters, as returned by Koncorde.normalize
   * @return {Long} ID of the message sent to other nodes
   */
  async sendNewRealtimeRoom (roomId, index, collection, filters) {
    const payload = {
      collection,
      filters: JSON.stringify(filters),
      index,
      roomId,
    };

    return this.send('NewRealtimeRoom', payload);
  }

  /**
   * Publishes an event telling telling them that this node
   * no longer has subscribers on the provided realtime room.
   *
   * @param  {string} roomId
   * @return {Long} ID of the message sent to other nodes
   */
  async sendRealtimeRoomRemoval (roomId) {
    return this.send('RemoveRealtimeRoom', { roomId });
  }

  /**
   * Publishes an event telling that a room has one less subscriber
   * @param  {string} roomId
   * @return {void}
   */
  async sendUnsubscription (roomId) {
    return this.send('Unsubscription', { roomId });
  }

  /**
   * Publishes an event telling that a new subscription has been made
   * made to an existing room
   *
   * @param  {string} roomId
   * @return {Long} Id of the message sent to other nodes
   */
  async sendSubscription (roomId) {
    return this.send('Subscription', { roomId });
  }

  /**
   * Publishes an event telling that a document notification must be
   * propagated
   *
   * @param  {Array.<string>} rooms - Koncorde rooms
   * @param  {DocumentNotification} notification
   * @return {Long} Id of the message sent to other nodes
   */
  async sendDocumentNotification (rooms, notification) {
    return this.send('DocumentNotification', {
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
  async sendUserNotification (room, notification) {
    return this.send('UserNotification', {
      action: notification.action,
      collection: notification.collection,
      controller: notification.controller,
      index: notification.index,
      protocol: notification.protocol,
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
   * @param {Object} strategyObject
   * @return {Long} Id of the message sent to other nodes
   */
  async sendNewAuthStrategy (strategyName, pluginName, strategyObject) {
    return this.send('NewAuthStrategy', {
      pluginName,
      strategy: strategyObject,
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
  async sendAuthStrategyRemoved (strategyName, pluginName) {
    return this.send('RemoveAuthStrategy', {
      pluginName,
      strategyName,
    });
  }

  /**
   * Publishes an event telling other nodes to create an info dump
   *
   * @param  {string} suffix - dump directory suffix name
   * @return {void}
   */
  async sendDumpRequest (suffix) {
    return this.send('DumpRequest', { suffix });
  }

  /**
   * Publishes an event about a new index cache item being added
   *
   * @param  {storeScopeEnum} scope
   * @param  {string} index
   * @param  {string} [collection]
   * @return {void}
   */
  async sendIndexCacheAdd (scope, index, collection) {
    return this.send('IndexCacheAdd', { collection, index, scope });
  }

  /**
   * Publishes an event about a new index cache item being removed
   *
   * @param  {storeScopeEnum} scope
   * @param  {string} index
   * @param  {string} [collection]
   * @return {void}
   */
  async sendIndexCacheRemove (scope, index, collection) {
    return this.send('IndexCacheRemove', { collection, index, scope });
  }

  /**
   * Broadcasts a sync message. Topic must match a protobuf type name.
   * @param  {String} topic name
   * @param  {Object} data
   * @returns {Long} ID of the message sent
   * @throws If the topic's protobuf type cannot be found
   */
  async send (topic, data) {
    this.lastMessageId = this.lastMessageId.add(1);
    const payload = Object.assign({ messageId: this.lastMessageId }, data);

    const type = this.protoroot.lookupType(topic);
    const buffer = type.encode(type.create(payload)).finish();

    await this.socket.send([topic, buffer]);

    return this.lastMessageId;
  }

  async dispose () {
    this.socket.close();
    this.socket = null;
  }
}

module.exports = ClusterPublisher;
