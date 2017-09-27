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
    this.cacheKeyPrefix = 'notif/';
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
    const channels = [];

    if (rooms.length === 0) {
      return;
    }

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
        .then(updatedNotification => {
          this._dispatch(channels, updatedNotification);
        });
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
  notifyUser (room, request, scope, content) {
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
        .then(updatedNotification => {
          this._dispatch(channels, updatedNotification);
        });
    }
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
   * Notify subscribed users with a realtime message
   *
   * @param {Request} request
   * @param {string} scope - Scope of the notification
   * @param {string} state - State of the notification
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
        this.kuzzle.services.list.internalCache.add(this.cacheKeyPrefix + request.id, rooms)
          .then(() => this.kuzzle.services.list.internalCache.expire(this.cacheKeyPrefix + request.id, 10));
      }

      this.notifyDocument(rooms, request, scope, state, request.input.action, {
        _source: _.omit(request.input.body, ['_kuzzle_info']),
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
   */
  notifyDocumentCreate (request, newDocument) {
    return this.kuzzle.services.list.internalCache.search(this.cacheKeyPrefix + request.id)
      .then(rooms => {
        this.notifyDocument(rooms, request, 'in', 'done', 'create', {
          _meta: newDocument._meta || {},
          _source: newDocument._source,
          _id: newDocument._id
        });

        return this.kuzzle.services.list.internalCache.add(this.cacheKeyPrefix + newDocument._id, rooms);
      })
      .catch(error => this.kuzzle.pluginsManager.trigger('log:error', error));
  }

  /**
   * Notify rooms that, either :
   *    - an updated document is now in their scope
   *    - a document they listened to left their scope
   *
   * @param {Request} request - object describing the original user request
   * @param {Promise}
   */
  notifyDocumentReplace (request) {
    let matchedRooms;

    return this.kuzzle.services.list.internalCache.search(this.cacheKeyPrefix + request.id)
      .then(rooms => {
        const _meta = request.input.body._kuzzle_info;
        delete request.input.body._kuzzle_info;

        matchedRooms = rooms;
        this.notifyDocument(rooms, request, 'in', 'done', 'replace', {
          _meta,
          _source: request.input.body,
          _id: request.input.resource._id
        });

        return this.kuzzle.services.list.internalCache.search(this.cacheKeyPrefix + request.input.resource._id);
      })
      .then(cachedRooms => {
        const stopListening = _.difference(cachedRooms, matchedRooms);

        this.notifyDocument(stopListening, request, 'out', 'done', 'replace', {
          _id: request.input.resource._id
        });

        return this.kuzzle.services.list.internalCache.remove(this.cacheKeyPrefix + request.input.resource._id, stopListening);
      })
      .then(() => this.kuzzle.services.list.internalCache.add(this.cacheKeyPrefix + request.input.resource._id, matchedRooms))
      .catch(error => this.kuzzle.pluginsManager.trigger('log:error', error));
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

        return this.kuzzle.services.list.internalCache.search(this.cacheKeyPrefix + updatedDocument._id);
      })
      .then(cachedRooms => {
        const
          stopListening = _.difference(cachedRooms, matchedRooms);

        this.notifyDocument(stopListening, request, 'out', 'done', 'update', {
          _id: updatedDocument._id
        });

        return this.kuzzle.services.list.internalCache.remove(this.cacheKeyPrefix + updatedDocument._id, stopListening);
      })
      .then(() => this.kuzzle.services.list.internalCache.add(this.cacheKeyPrefix + updatedDocument._id, matchedRooms))
      .catch(error => this.kuzzle.pluginsManager.trigger('log:error', error));
  }

  /**
   * Notify rooms that a document they listened to has been deleted
   *
   * @param {Request} request
   * @param {Array} ids - list of deleted document IDs
   */
  notifyDocumentDelete (request, ids) {
    return Bluebird.all(ids.map(id => {
      const
        getRequest = new Request({
          collection: request.input.resource.collection,
          index: request.input.resource.index,
          _id: id,
          includeTrash: true
        });

      return this.kuzzle.services.list.storageEngine.get(getRequest)
        .then(result => {
          const 
            deletedDocument = result;

          const matchedRooms = this.kuzzle.realtime.test(
            request.input.resource.index,
            request.input.resource.collection,
            result._source,
            result._id);

          this.notifyDocument(matchedRooms, request, 'out', 'done', 'delete', {
            _meta: deletedDocument._meta || {},
            _id: deletedDocument._id
          });

          return Bluebird.resolve(id);
        });
    }));
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
  _dispatch (channels, notification, connectionId, trigger = true) {
    if (trigger) {
      this.kuzzle.pluginsManager.trigger('core:notify:dispatch', {channels, notification, connectionId});
    }

    this.kuzzle.pluginsManager.trigger('notify:dispatch', notification)
      .then(updatedNotification => {
        this.kuzzle.entryPoints.dispatch(connectionId ? 'notify' : 'broadcast', {
          channels, 
          connectionId, 
          payload: updatedNotification
        });
      });
  }
}

module.exports = NotifierController;
