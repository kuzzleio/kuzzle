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
  constructor(kuzzle) {
    this.kuzzle = kuzzle;
  }

  async init () {
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
  notifyDocument (rooms, request, scope, action, content) {
    if (rooms.length === 0) {
      return Bluebird.resolve();
    }

    this.kuzzle.emit('core:notify:document', {
      action,
      content,
      request: request.serialize(),
      rooms,
      scope
    });

    return this._notifyDocument(
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
   * Send a server notification to a provided connection identifier
   *
   * @param {Array} rooms - User's rooms to notify
   * @param {string} connectionId - User's connection identifier
   * @param {string} type - Server notification type
   * @param {string} message - Additional information
   *
   * @returns {Promise}
   */
  async notifyServer (rooms, connectionId, type, message) {
    const channels = [];

    if (rooms.length > 0) {
      for (const room of rooms) {
        const hotelClerkRoom = this.kuzzle.hotelClerk.rooms.get(room);

        if (hotelClerkRoom !== undefined) {
          channels.push(...Object.keys(hotelClerkRoom.channels));
        }
      }

      if (channels.length > 0) {
        return this._dispatch(
          'notify:server',
          channels,
          new ServerNotification(type, message),
          connectionId);
      }
    }

    return null;
  }

  /**
   * Notify subscribed users on a real-time message or
   * when a document is about to be created or replaced
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  publish (request) {
    const rooms = this._test(request);

    return this.notifyDocument(rooms, request, 'in', request.input.action, {
      _id: request.input.resource._id,
      _source: request.input.body
    });
  }

  /**
   * Notify rooms that a newly created document entered their scope
   *
   * @param {Request} request
   * @param {object} newDocument - the newly created document
   * @returns {Promise}
   */
  notifyDocumentCreate (request, newDocument) {
    const
      cachePrefix = getCachePrefix(request),
      rooms = this._test(request, newDocument._source, newDocument._id);

    return this
      .notifyDocument(rooms, request, 'in', 'create', {
        _id: newDocument._id,
        _source: newDocument._source
      })
      .then(() => this._setCacheWithTTL(
        cachePrefix + newDocument._id,
        JSON.stringify(rooms)));
  }

  /**
   * Notify rooms that, either :
   *    - a replaced document is now (or still) in their scope
   *    - a document they listened to left their scope
   *
   * @param {Request} request - object describing the original user request
   * @returns {Promise}
   */
  notifyDocumentReplace (request) {
    const
      cacheId = getCachePrefix(request) + request.input.resource._id,
      rooms = this._test(request);

    return this
      .notifyDocument(rooms, request, 'in', 'replace', {
        _id: request.input.resource._id,
        _source: request.input.body
      })
      .then(() => this.cacheEngine.get(cacheId))
      .then(cachedRooms => {
        if (cachedRooms !== null) {
          const stopListening = _.difference(JSON.parse(cachedRooms), rooms);

          return this.notifyDocument(stopListening, request, 'out', 'replace', {
            _id: request.input.resource._id
          });
        }

        return null;
      })
      .then(() => {
        if (rooms.length === 0) {
          return this.cacheEngine.del(cacheId);
        }

        return this._setCacheWithTTL(cacheId, JSON.stringify(rooms));
      })
      .catch(error => this.kuzzle.log.error(error));
  }

  /**
   * Notify rooms matching multiple documents changes: creations, replacements,
   * or updates
   *
   * @param {Request} request - object describing the original user request
   * @param {Array} documents - new documents
   * @param {boolean} cached - Documents may have been cached
   * @returns {Promise}
   */
  notifyDocumentMChanges (request, documents, cached) {
    const
      prefix = getCachePrefix(request),
      controllerAction = request.input.action,
      cacheIds = documents.map(document => prefix + document._id);

    return (cached ? this.cacheEngine.mget(cacheIds) : Bluebird.resolve([]))
      .then(hits => {
        const
          idsToDelete = [],
          promises = [];

        for (let i = 0; i < documents.length; i++) {
          const
            documentAction = documents[i].created ? 'create' : controllerAction,
            rooms = this._test(request, documents[i]._source, documents[i]._id);

          // document previously listened by rooms
          if (hits[i] !== null && hits[i] !== undefined) {
            const stopListening = _.difference(JSON.parse(hits[i]), rooms);

            promises.push(
              this.notifyDocument(
                stopListening,
                request,
                'out',
                documentAction,
                {_id: documents[i]._id}));
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

        return Bluebird.all(promises);
      });
  }

  /**
   * Notify rooms that, either :
   *    - an updated document is now in their scope
   *    - a document they listened to left their scope
   *
   * @param {Request} request
   *
   * @returns {Promise}
   */
  async notifyDocumentUpdate (request, updatedDocument) {

    const
      matchedRooms = this._test(
        request,
        updatedDocument._source,
        updatedDocument._id);
    const cacheId = getCachePrefix(request) + updatedDocument._id;

    const updatedFields = Object.keys(request.input.body)
      .filter(_updatedFields => _updatedFields !== '_kuzzle_info');

    try {
      await this.notifyDocument(matchedRooms, request, 'in', 'update', {
        _id: updatedDocument._id,
        _source: updatedDocument._source,
        _updatedFields: updatedFields
      });
      const cachedRooms = await this.cacheEngine.get(cacheId);
      if (cachedRooms !== null) {
        const stopListening = _.difference(
          JSON.parse(cachedRooms), matchedRooms);

        await this.notifyDocument(stopListening, request, 'out', 'update', {
          _id: updatedDocument._id
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
   * @param {Array} documents - list of deleted document
   *
   * @returns {Promise}
   */
  notifyDocumentMDelete (request, documents) {
    if (documents.length === 0) {
      return Bluebird.resolve();
    }

    const
      { index, collection } = request.input.resource,
      cachePrefix = getCachePrefix(request),
      cacheKeys = [],
      promises = [];

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
      const hotelClerkRoom = this.kuzzle.hotelClerk.rooms.get(room);

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
    const hotelClerkRoom = this.kuzzle.hotelClerk.rooms.get(room);

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
