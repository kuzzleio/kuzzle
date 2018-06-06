/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
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

const
  _ = require('lodash'),
  Bluebird = require('bluebird'),
  Notification = require('./models/notifications'),
  Request = require('kuzzle-common-objects').Request;

/**
 * This internal service can either be invoked directly by
 * Kuzzle internal components, or through the internal
 * broker. This second way of communication is used
 * by workers to notify rooms about their work.
 *
 * @class NotifierController
 */
class NotifierController {
  constructor(kuzzle) {
    this.kuzzle = kuzzle;
  }

  /**
   * Broadcasts a notification about a document change or a
   * real-time message
   *
   * @param  {Array} rooms - Subscribed rooms to notify
   * @param  {Request} request - Request at the origin of the notification
   * @param  {string} scope - 'in' or 'out'
   * @param  {string} state - 'pending' or 'done'
   * @param  {string} action - Notification type
   * @param  {object} content - Document or message
   */
  notifyDocument (rooms, request, scope, state, action, content) {
    if (rooms.length === 0) {
      return;
    }

    this.kuzzle.pluginsManager.trigger('core:notify:document', {
      rooms,
      scope,
      state,
      action,
      content,
      request: request.serialize()
    });

    return this._notifyDocument(rooms, request, scope, state, action, content);
  }

  /**
   * Broadcast a notification about a user entering or leaving
   * the provided room
   *
   * @param  {string} room - Room entered or left
   * @param  {Request} request - User (un)subscription request
   * @param  {string} scope - 'in' or 'out'
   * @param  {object} content - Notification additional informations
   */
  notifyUser (room, request, scope, content) {
    this.kuzzle.pluginsManager.trigger('core:notify:user', {
      room,
      scope,
      content,
      request: request.serialize()
    });

    return this._notifyUser(room, request, scope, content);
  }

  /**
   * Send a server notification to a provided connection identifier
   *
   * @param  {Array} rooms - User's rooms to notify
   * @param  {string} connectionId - User's connection identifier
   * @param  {string} type - Server notification type
   * @param  {string} message - Additional information
   */
  notifyServer (rooms, connectionId, type, message) {
    const channels = [];

    if (rooms.length === 0) {
      return;
    }

    for (const room of rooms) {
      const hotelClerkRoom = this.kuzzle.hotelClerk.rooms[room];

      if (hotelClerkRoom !== undefined) {
        channels.push(...Object.keys(hotelClerkRoom.channels));
      }
    }

    if (channels.length > 0) {
      const notification = new Notification.Server(type, message);

      this.kuzzle.pluginsManager.trigger('notify:server', notification)
        .then(updatedNotification => {
          this._dispatch(channels, updatedNotification, connectionId);
        });
    }
  }

  /**
   * Notify subscribed users on a real-time message or
   * when a document is about to be created or replaced
   *
   * @param {Request} request
   * @param {string} scope - Scope of the notification
   * @param {string} state - State of the notification
   * @returns {Object}
   */
  publish (request, scope, state) {
    const rooms = this.kuzzle.realtime.test(
      request.input.resource.index,
      request.input.resource.collection,
      request.input.body || {},
      request.input.resource._id
    );

    if (rooms.length > 0) {
      if (request.input.controller === 'document' && ['create', 'createOrReplace', 'replace'].includes(request.input.action)) {
        /*
         since we have the complete document, we use the cache to avoid performing another test when
         notifying about document creations
         */
        this._setCacheWithTTL(getCachePrefix(request) + request.id, JSON.stringify(rooms), 10);
      }

      this.notifyDocument(rooms, request, scope, state, request.input.action, {
        _source: request.input.body,
        _id: request.input.resource._id
      });
    }

    return {published: true};
  }

  /**
   * Notify rooms that a newly created document entered their scope
   *
   * @param {Request} request
   * @param {object} newDocument - the newly created document
   * @returns {Promise}
   */
  notifyDocumentCreate (request, newDocument) {
    const cachePrefix = getCachePrefix(request);
    return this.kuzzle.services.list.internalCache.get(cachePrefix + request.id)
      .then(rooms => {
        if (rooms !== null) {
          this.notifyDocument(JSON.parse(rooms), request, 'in', 'done', 'create', {
            _meta: newDocument._meta || {},
            _source: newDocument._source,
            _id: newDocument._id
          });

          return this._setCacheWithTTL(cachePrefix + newDocument._id, rooms);
        }

        return null;
      })
      .catch(error => this.kuzzle.pluginsManager.trigger('log:error', error));
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
    const cachePrefix = getCachePrefix(request);
    let
      matchedRooms = [],
      rawMatchedRooms = null;

    return this.kuzzle.services.list.internalCache.get(cachePrefix + request.id)
      .then(rooms => {
        if (rooms !== null) {
          rawMatchedRooms = rooms;
          matchedRooms = JSON.parse(rooms);
          this.notifyDocument(matchedRooms, request, 'in', 'done', 'replace', {
            _meta: request.input.body._kuzzle_info,
            _source: request.input.body,
            _id: request.input.resource._id
          });
        }

        return this.kuzzle.services.list.internalCache.get(cachePrefix + request.input.resource._id);
      })
      .then(cachedRooms => {
        if (cachedRooms !== null) {
          const stopListening = _.difference(JSON.parse(cachedRooms), matchedRooms);

          this.notifyDocument(stopListening, request, 'out', 'done', 'replace', {
            _id: request.input.resource._id
          });
        }

        if (rawMatchedRooms === null) {
          return this.kuzzle.services.list.internalCache.del(cachePrefix + request.input.resource._id);
        }

        return this._setCacheWithTTL(cachePrefix + request.input.resource._id, rawMatchedRooms);
      })
      .catch(error => this.kuzzle.pluginsManager.trigger('log:error', error));
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
      cacheIds = [];

    // Declaring "i" inside "for" statements downgrades
    // performances by a factor of 3 to 4
    // Fixed in Node.js v8.x and up
    let i; //NOSONAR

    for(i = 0; i < documents.length; i++) {
      cacheIds.push(prefix + documents[i]._id);
    }

    return (cached ? this.kuzzle.services.list.internalCache.mget(cacheIds) : Bluebird.resolve([]))
      .then(hits => {
        const idsToDelete = [];

        for (i = 0; i < documents.length; i++) {
          const
            documentAction = documents[i].created ? 'create' : controllerAction,
            rooms = this.kuzzle.realtime.test(
              request.input.resource.index,
              request.input.resource.collection,
              documents[i]._source,
              documents[i]._id
            );

          // document previously listened by rooms
          if (hits[i] !== null && hits[i] !== undefined) {
            const stopListening = _.difference(JSON.parse(hits[i]), rooms);

            this.notifyDocument(stopListening, request, 'out', 'done', documentAction, {
              _id: documents[i]._id
            });
          }

          if (rooms.length > 0) {
            this.notifyDocument(rooms, request, 'in', 'done', documentAction, {
              _source: documents[i]._source,
              _id: documents[i]._id
            });

            this._setCacheWithTTL(cacheIds[i], JSON.stringify(rooms));
          } else if (hits[i] !== null && hits[i] !== undefined) {
            idsToDelete.push(cacheIds[i]);
          }
        }

        if (idsToDelete.length > 0) {
          this.kuzzle.services.list.internalCache.del(idsToDelete);
        }
      });
  }

  /**
   * Notify rooms that, either :
   *    - an updated document is now in their scope
   *    - a document they listened to left their scope
   *
   * @param {Request} request
   */
  notifyDocumentUpdate (request) {
    let
      matchedRooms,
      updatedDocument;
    const
      cachePrefix = getCachePrefix(request),
      getRequest = new Request({
        action: 'update',
        controller: 'document',
        collection: request.input.resource.collection,
        index: request.input.resource.index,
        _id: request.input.resource._id,
        requestId: request.id,
        volatile: request.input.volatile
      });

    return this.kuzzle.services.list.storageEngine.get(getRequest)
      .then(result => {
        updatedDocument = result;

        matchedRooms = this.kuzzle.realtime.test(
          request.input.resource.index,
          request.input.resource.collection,
          result._source,
          result._id);

        this.notifyDocument(matchedRooms, request, 'in', 'done', 'update', {
          _meta: updatedDocument._meta || {},
          _id: updatedDocument._id,
          _source: updatedDocument._source
        });

        return this.kuzzle.services.list.internalCache.get(cachePrefix + updatedDocument._id);
      })
      .then(cachedRooms => {
        if (cachedRooms !== null) {
          const stopListening = _.difference(JSON.parse(cachedRooms), matchedRooms);

          this.notifyDocument(stopListening, request, 'out', 'done', 'update', {
            _id: updatedDocument._id
          });
        }

        if (matchedRooms.length > 0) {
          return this._setCacheWithTTL(cachePrefix + updatedDocument._id, JSON.stringify(matchedRooms));
        }

        return this.kuzzle.services.list.internalCache.del(cachePrefix + updatedDocument._id);
      })
      .catch(error => this.kuzzle.pluginsManager.trigger('log:error', error));
  }

  /**
   * Notify rooms that a document they listened to has been deleted
   *
   * @param {Request} request
   * @param {Array} ids - list of deleted document IDs
   */
  notifyDocumentMDelete (request, ids) {
    if (ids.length === 0) {
      return Bluebird.resolve();
    }

    const
      getRequest = new Request({
        collection: request.input.resource.collection,
        index: request.input.resource.index,
        body: {ids},
        includeTrash: true
      });

    return this.kuzzle.services.list.storageEngine.mget(getRequest)
      .then(deleted => {
        const
          cachePrefix = getCachePrefix(request),
          cacheKeys = [];

        // Declaring "i" inside "for" statements downgrades
        // performances by a factor of 3 to 4
        // Fixed in Node.js v8.x and up
        let i; // NOSONAR
        for(i = 0; i < deleted.hits.length; i++) {
          const matchedRooms = this.kuzzle.realtime.test(
            request.input.resource.index,
            request.input.resource.collection,
            deleted.hits[i]._source,
            deleted.hits[i]._id);

          this.notifyDocument(matchedRooms, request, 'out', 'done', 'delete', {
            _meta: deleted.hits[i]._meta || {},
            _id: deleted.hits[i]._id
          });

          cacheKeys.push(cachePrefix + deleted.hits[i]._id);
        }

        if (cacheKeys.length > 0) {
          return this.kuzzle.services.list.internalCache.del(cacheKeys);
        }
      });
  }

  /**
   * Trigger a notify global event and, if accepted by plugins,
   * dispatch the payload to subscribers
   *
   * @param  {Array} channels - Subscribers channels to notify
   * @param  {Notification.User|Notification.Document|Notification.Server} notification
   * @param  {string} [connectionId] - Notify this connection, or broadcast if not provided
   * @param  {boolean} [trigger] - If set to true, triggers Kuzzle plugins
   */
  _dispatch (channels, notification, connectionId) {
    this.kuzzle.pluginsManager.trigger('notify:dispatch', notification)
      .then(updatedNotification => {
        this.kuzzle.entryPoints.dispatch(connectionId ? 'notify' : 'broadcast', {
          channels,
          connectionId,
          payload: updatedNotification
        });
      });
  }

  /**
   * Broadcasts a notification about a document change or a
   * real-time message
   *
   * @param  {Array} rooms - Subscribed rooms to notify
   * @param  {Request} request - Request at the origin of the notification
   * @param  {string} scope - 'in' or 'out'
   * @param  {string} state - 'pending' or 'done'
   * @param  {string} action - Notification type
   * @param  {object} content - Document or message
   */
  _notifyDocument (rooms, request, scope, state, action, content) {
    const channels = [];

    for (const room of rooms) {
      const hotelClerkRoom = this.kuzzle.hotelClerk.rooms[room];

      if (hotelClerkRoom !== undefined) {
        for (const channel of Object.keys(hotelClerkRoom.channels)) {
          const
            c = hotelClerkRoom.channels[channel],
            stateMatch = c.state === 'all' || c.state === state,
            scopeMatch = c.scope === 'all' || c.scope === scope;

          if (stateMatch && scopeMatch) {
            channels.push(channel);
          }
        }
      }
    }

    if (channels.length > 0) {
      const notification = new Notification.Document(request, scope, state, action, content);

      this.kuzzle.pluginsManager.trigger('notify:document', notification)
        .then(updatedNotification => this._dispatch(channels, updatedNotification));
    }
  }

  /**
   * Broadcast a notification about a user entering or leaving
   * the provided room
   *
   * @param  {string} room - Room entered or left
   * @param  {Request} request - User (un)subscription request
   * @param  {string} scope - 'in' or 'out'
   * @param  {object} content - Notification additional informations
   */
  _notifyUser (room, request, scope, content) {
    const
      channels = [],
      hotelClerkRoom = this.kuzzle.hotelClerk.rooms[room];

    if (hotelClerkRoom !== undefined) {
      for (const channel of Object.keys(hotelClerkRoom.channels)) {
        const channelUsers = hotelClerkRoom.channels[channel].users;

        if (channelUsers === 'all' || channelUsers === scope) {
          channels.push(channel);
        }
      }
    }

    if (channels.length > 0) {
      const notification = new Notification.User(request, scope, content);

      this.kuzzle.pluginsManager.trigger('notify:user', notification)
        .then(updatedNotification => this._dispatch(channels, updatedNotification));
    }
  }

  /**
   * Set something in Redis cache with a TTL if it's provided.
   * Use the ttl passed in parameter or the default value set in limits.subscriptionDocumentTTL.
   *
   * @param {string} key - Redis key to use
   * @param {string} value - Value to store
   * @param {integer} ttl - TTL value for the key, use limits.subscriptionDocumentTTL by default.
   */
  _setCacheWithTTL (key, value, ttl = this.kuzzle.config.limits.subscriptionDocumentTTL) {
    if (ttl === 0) {
      return this.kuzzle.services.list.internalCache.set(key, value);
    }

    return this.kuzzle.services.list.internalCache.setex(key, ttl, value);
  }
}

function getCachePrefix(request) {
  return '{'
    // start of redis key hash tag
    // (see https://redis.io/topics/cluster-spec#keys-distribution-model)
    + 'notif/'
    + request.input.resource.index
    + '/'
    + request.input.resource.collection
    + '}'
    // end of redis key hash tag
    + '/';
}

module.exports = NotifierController;
