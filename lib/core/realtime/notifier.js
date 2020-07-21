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

const _ = require('lodash');
const Bluebird = require('bluebird');

const {
  DocumentNotification,
  ServerNotification,
  UserNotification,
} = require('../../model/notification');

/**
 * @class NotifierController
 */
class NotifierController {
  constructor(kuzzle, realtimeModule) {
    this.kuzzle = kuzzle;
    this.module = realtimeModule;
  }

  async init () {
    /**
     * Send a "new document created" notification
     * @param {Request} request
     * @param {string} id -- created document id
     * @param {Object} content -- created document content
     */
    this.kuzzle.onAsk(
      'core:realtime:notify:created',
      (request, id, content) => this.notifyDocumentCreate(request, id, content));

    /**
     * Send a "document deleted" notification
     *
     * @param {Request} request - object describing the original user request
     * @param {string} _id
     * @param {Object} _source
     */
    this.kuzzle.onAsk(
      'core:realtime:notify:deleted',
      (request, _id, _source) => {
        return this.notifyDocumentMDelete(request, [{_id, _source}]);
      });

    /**
     * Send notifications for a set of create, replace, or update changes
     *
     * @param {Request} request - object describing the original user request
     * @param {Array.<{_id: string, _source: object, created: boolean}>} documents
     * @param {boolean} [cached] - Documents may have been cached
     */
    this.kuzzle.onAsk(
      'core:realtime:notify:mChanged',
      (request, docs, cached = false) => {
        return this.notifyDocumentMChanges(request, docs, cached);
      });

    /**
     * Send notifications for a group of create, replace, or update changes
     *
     * @param {Request} request - object describing the original user request
     * @param {Array.<{_id: string, _source: object}>} documents
     */
    this.kuzzle.onAsk(
      'core:realtime:notify:mDeleted',
      (request, docs) => this.notifyDocumentMDelete(request, docs));

    /**
     * Send a "document replaced" notification
     * @param {Request} request
     */
    this.kuzzle.onAsk(
      'core:realtime:notify:replaced',
      request => this.notifyDocumentReplace(request));

    /**
     * Send a "document updated" notification
     * @param {Request} request
     */
    this.kuzzle.onAsk(
      'core:realtime:notify:updated',
      (request, id, content) => this.notifyDocumentUpdate(request, id, content));

    /**
     * Send a "token expired" notification to the target user
     * @param {string} connectionId
     */
    this.kuzzle.onAsk(
      'core:realtime:notify:tokenExpired',
      connectionId => this.notifyTokenExpired(connectionId));

    /**
     * Publish the provided request content to listening subscribers
     * @param {Request} request
     */
    this.kuzzle.onAsk('core:realtime:publish', request => this.publish(request));
  }

  get cacheEngine () {
    return this.kuzzle.cacheEngine.internal;
  }

  get storageEngine () {
    return this.kuzzle.storageEngine.public;
  }

  /**
   * Broadcasts a notification about a document change or a
   * real-time message
   *
   * @param {Array} rooms - Subscribed rooms to notify
   * @param {Request} request - Request at the origin of the notification
   * @param {string} scope - 'in' or 'out'
   * @param {string} action - Notification type
   * @param {object} content - Document or message
   *
   * @returns {Promise}
   */
  async notifyDocument (rooms, request, scope, action, content) {
    if (rooms.length === 0) {
      return;
    }

    this.kuzzle.emit('core:notify:document', {
      action,
      content,
      request: request.serialize(),
      rooms,
      scope
    });

    await this._notifyDocument(
      rooms,
      request,
      scope,
      action,
      content,
      { fromCluster: false });
  }

  /**
   * Broadcast a notification about a user entering or leaving
   * the provided room
   *
   * @param {string} room - Room entered or left
   * @param {Request} request - User (un)subscription request
   * @param {string} scope - 'in' or 'out'
   * @param {object} content - Notification additional informations
   *
   * @returns {Promise}
   */
  notifyUser (room, request, scope, content) {
    this.kuzzle.emit('core:notify:user', {
      content,
      request: request.serialize(),
      room,
      scope
    });

    return this._notifyUser(
      room,
      request,
      scope,
      content,
      { fromCluster: false });
  }

  /**
   * Send a "token expired" notification to the target user
   *
   * @param {string} connectionId - User's connection identifier
   * @returns {Promise}
   */
  async notifyTokenExpired (connectionId) {
    const rooms = this.module.hotelClerk.getUserRooms(connectionId);

    if (rooms.length === 0) {
      return;
    }

    const channels = [];

    for (const room of rooms) {
      const hotelClerkRoom = this.module.hotelClerk.rooms.get(room);

      if (hotelClerkRoom !== undefined) {
        channels.push(...Object.keys(hotelClerkRoom.channels));
      }
    }

    if (channels.length > 0) {
      await this._dispatch(
        'notify:server',
        channels,
        new ServerNotification('TokenExpired', 'Authentication Token Expired'),
        connectionId);
    }

    await this.module.hotelClerk.disconnect(connectionId);
  }

  /**
   * Publish the content of the provided request to listening subscribers
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  publish (request) {
    const rooms = this._test(request);

    return this.notifyDocument(rooms, request, 'in', 'publish', {
      _id: request.input.resource._id,
      _source: request.input.body
    });
  }

  /**
   * Notify rooms that a newly created document entered their scope
   *
   * @param {Request} request
   * @param {string} id - new document id
   * @param {Object} content - new document content
   * @returns {Promise}
   */
  async notifyDocumentCreate (request, id, content) {
    const cachePrefix = getCachePrefix(request);
    const rooms = this._test(request, content, id);

    await this.notifyDocument(rooms, request, 'in', 'create', {
      _id: id,
      _source: content,
    });

    await this._setCacheWithTTL(cachePrefix + id, JSON.stringify(rooms));
  }

  /**
   * Notify rooms that, either :
   *    - a replaced document is now (or still) in their scope
   *    - a document they listened to left their scope
   *
   * @param {Request} request - object describing the original user request
   * @returns {Promise}
   */
  async notifyDocumentReplace (request) {
    const cacheId = getCachePrefix(request) + request.input.resource._id;
    const rooms = this._test(request);

    await this.notifyDocument(rooms, request, 'in', 'replace', {
      _id: request.input.resource._id,
      _source: request.input.body
    });

    const cachedRooms = await this.cacheEngine.get(cacheId);

    if (cachedRooms !== null) {
      const stopListening = _.difference(JSON.parse(cachedRooms), rooms);

      await this.notifyDocument(stopListening, request, 'out', 'replace', {
        _id: request.input.resource._id
      });
    }

    if (rooms.length === 0) {
      await this.cacheEngine.del(cacheId);
    }
    else {
      await this._setCacheWithTTL(cacheId, JSON.stringify(rooms));
    }
  }

  /**
   * Notify rooms matching multiple documents changes: creations, replacements,
   * or updates
   *
   * @param {Request} request - object describing the original user request
   * @param {Array.<{_id: string, _source: object, created: boolean}>} documents
   * @param {boolean} cached - Documents may have been cached
   * @returns {Promise}
   */
  async notifyDocumentMChanges (request, documents, cached) {
    const prefix = getCachePrefix(request);
    const controllerAction = request.input.action;
    const cacheIds = documents.map(document => prefix + document._id);

    const hits = cached ? await this.cacheEngine.mget(cacheIds) : [];
    const idsToDelete = [];
    const promises = [];

    for (let i = 0; i < documents.length; i++) {
      const documentAction = documents[i].created ? 'create' : controllerAction;
      const rooms = this._test(request, documents[i]._source, documents[i]._id);

      // document previously listened by rooms
      if (hits[i] !== null && hits[i] !== undefined) {
        const stopListening = _.difference(JSON.parse(hits[i]), rooms);

        if (stopListening.length > 0) {
          promises.push(
            this.notifyDocument(stopListening, request, 'out', documentAction, {
              _id: documents[i]._id,
            }));
        }
      }

      if (rooms.length > 0) {
        promises.push(
          this.notifyDocument(rooms, request, 'in', documentAction, {
            _id: documents[i]._id,
            _source: documents[i]._source
          }));

        promises.push(
          this._setCacheWithTTL(cacheIds[i], JSON.stringify(rooms)));
      }
      else if (hits[i] !== null && hits[i] !== undefined) {
        idsToDelete.push(cacheIds[i]);
      }
    }

    if (idsToDelete.length > 0) {
      promises.push(this.cacheEngine.del(idsToDelete));
    }

    await Bluebird.all(promises);
  }

  /**
   * Notify rooms that, either :
   *    - an updated document is now in their scope
   *    - a document they listened to left their scope
   *
   * @param {Request} request
   * @param {string} id
   * @param {Object} content
   * @returns {Promise}
   */
  async notifyDocumentUpdate (request, id, content) {
    const matchedRooms = this._test(request, content, id);
    const cacheId = getCachePrefix(request) + id;

    const updatedFields = Object.keys(request.input.body)
      .filter(_updatedFields => _updatedFields !== '_kuzzle_info');

    try {
      await this.notifyDocument(matchedRooms, request, 'in', 'update', {
        _id: id,
        _source: content,
        _updatedFields: updatedFields,
      });

      const cachedRooms = await this.cacheEngine.get(cacheId);

      if (cachedRooms !== null) {
        const stopListening = _.difference(
          JSON.parse(cachedRooms),
          matchedRooms);

        await this.notifyDocument(stopListening, request, 'out', 'update', {
          _id: id,
        });
      }
    }
    catch (error) {
      this.kuzzle.log.error(error);
    }

    return matchedRooms.length > 0
      ? this._setCacheWithTTL(cacheId, JSON.stringify(matchedRooms))
      : this.cacheEngine.del(cacheId);
  }

  /**
   * Notify rooms that a document they listened to has been deleted
   *
   * @param {Request} request
   * @param {Array.<{_id: string, _source: Object}>} documents
   *
   * @returns {Promise}
   */
  notifyDocumentMDelete (request, documents) {
    if (documents.length === 0) {
      return Bluebird.resolve();
    }

    const { index, collection } = request.input.resource;
    const cachePrefix = getCachePrefix(request);
    const cacheKeys = [];
    const promises = [];

    for (let i = 0; i < documents.length; i++) {
      const matchedRooms = this.kuzzle.koncorde.test(
        index,
        collection,
        documents[i]._source,
        documents[i]._id);

      promises.push(
        this.notifyDocument(
          matchedRooms,
          request,
          'out',
          'delete',
          {_id: documents[i]._id}));

      cacheKeys.push(cachePrefix + documents[i]._id);
    }

    if (cacheKeys.length > 0) {
      promises.push(this.cacheEngine.del(cacheKeys));
    }

    return Bluebird.all(promises);
  }

  /**
   * Trigger a notify global event and, if accepted by plugins,
   * dispatch the payload to subscribers
   *
   * @param {Array} channels - Subscribers channels to notify
   * @param {Notification.User|Notification.Document|Notification.Server} notification
   * @param {string} [connectionId] - Notify this connection, or broadcast
   *                                   if not provided
   * @param {boolean} [trigger] - If set to true, triggers Kuzzle plugins
   *
   * @returns {Promise}
   */
  async _dispatch (event, channels, notification, connectionId) {
    try {
      let updated = await this.kuzzle.pipe(event, notification);
      updated = await this.kuzzle.pipe('notify:dispatch', updated);

      const action = connectionId ? 'notify' : 'broadcast';

      this.kuzzle.entryPoint.dispatch(action, {
        channels,
        connectionId,
        payload: updated
      });
    }
    catch (error) {
      this.kuzzle.log.error(error);
    }
  }

  /**
   * Broadcasts a notification about a document change or a
   * real-time message.
   *
   * When this method is called from the node who received
   * the request triggering notification, then every channel is notified
   * regardless the "cluster" option.
   *
   * When this method is called from the cluster synchronization,
   * then only the channel having the "cluster: true" option are notified
   *
   * @param {Array} rooms - Subscribed rooms to notify
   * @param {Request} request - Request at the origin of the notification
   * @param {string} scope - 'in' or 'out'
   * @param {string} action - Notification type
   * @param {object} content - Document or message
   * @param {object} [options] - fromCluster (true)
   *
   * @returns {Promise}
   */
  _notifyDocument (rooms, request, scope, action, content, { fromCluster=true } = {}) {
    const channels = [];

    for (const room of rooms) {
      const hotelClerkRoom = this.module.hotelClerk.rooms.get(room);

      if (hotelClerkRoom === undefined) {
        continue;
      }

      for (const [channelId, channel] of Object.entries(hotelClerkRoom.channels)) {
        const matchScope = channel.scope === 'all' || channel.scope === scope;
        const executeOnNode = fromCluster ? channel.cluster : true;

        if (matchScope && executeOnNode) {
          channels.push(channelId);
        }
      }
    }

    if (channels.length === 0) {
      return Bluebird.resolve();
    }

    const notif = new DocumentNotification(request, scope, action, content);

    return this._dispatch('notify:document', channels, notif);
  }

  /**
   * Broadcast a notification about a user entering or leaving
   * the provided room
   *
   * @param {string} room - Room entered or left
   * @param {Request} request - User (un)subscription request
   * @param {string} scope - 'in' or 'out'
   * @param {object} content - Notification additional informations
   *
   * @returns {Promise}
   */
  _notifyUser (room, request, scope, content) {
    const channels = [];
    const hotelClerkRoom = this.module.hotelClerk.rooms.get(room);

    if (hotelClerkRoom !== undefined) {
      for (const channel of Object.keys(hotelClerkRoom.channels)) {
        const channelUsers = hotelClerkRoom.channels[channel].users;

        if (channelUsers === 'all' || channelUsers === scope) {
          channels.push(channel);
        }
      }
    }

    if (channels.length === 0) {
      return Bluebird.resolve();
    }

    const notification = new UserNotification(request, scope, content);

    return this._dispatch('notify:user', channels, notification);
  }

  /**
   * Set something in Redis cache with a TTL if it's provided.
   * Use the ttl passed in parameter or the default value set in
   * limits.subscriptionDocumentTTL.
   *
   * @param {string} key - Redis key to use
   * @param {string} value - Value to store
   * @param {integer} ttl - TTL value for the key, use
   *                        limits.subscriptionDocumentTTL by default.
   *
   * @returns {Promise}
   */
  _setCacheWithTTL (
    key,
    value,
    ttl = this.kuzzle.config.limits.subscriptionDocumentTTL
  ) {
    if (ttl === 0) {
      return this.cacheEngine.set(key, value);
    }

    return this.cacheEngine.setex(key, ttl, value);
  }

  /**
   * DRYification for calls to Koncorde's test method from a Request object
   * @param {Request} request
   * @param {Object} source - document's source
   * @param {String} id
   *
   * @returns {Array.<string>}
   */
  _test (request, source = null, id = null) {
    return this.kuzzle.koncorde.test(
      request.input.resource.index,
      request.input.resource.collection,
      source || request.input.body || {},
      id || request.input.resource._id);
  }
}

function getCachePrefix(request) {
  // use redis key hash tag
  // (see https://redis.io/topics/cluster-spec#keys-distribution-model)
  return `{notif/${request.input.resource.index}/${request.input.resource.collection}}/`;
}

module.exports = NotifierController;
