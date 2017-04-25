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
  NotificationObject = require('./models/notificationObject'),
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
   * Notify rooms with a data object. Invoked directly by kuzzle
   * core components
   *
   * Notify by sending the message data on all corresponding channels
   * If no connection ID is provided, broadcasts the message on all users connected to the channels
   *
   * @param {Array} rooms - list of rooms to notify
   * @param {Request} request - the source request causing the notification
   * @param {object} content - the content of the notification (see NotificationObject constructor)
   * @param {string} [connectionId]
   * @returns {boolean}
   */
  notify(rooms, request, content, connectionId) {
    const
      eventName = connectionId ? 'notify' : 'broadcast',
      channels = [];

    if (!rooms || rooms.length === 0) {
      return false;
    }

    const notification = new NotificationObject(rooms.length > 1 ? 'Multiple rooms' : rooms[0], request, content);

    rooms.forEach(room => this.kuzzle.hotelClerk.addToChannels(channels, room, notification));

    if (channels.length > 0) {
      const data = {
        channels,
        connectionId,
        payload: notification.toJson()
      };

      this.kuzzle.entryPoints.proxy.dispatch(eventName, data);
      this.kuzzle.pluginsManager.trigger('proxy:' + eventName, data);
    }

    return true;
  }

  /**
   * Notify subscribed users with a realtime message
   *
   * @param {Request} request
   */
  publish(request) {
    const rooms = this.kuzzle.dsl.test(request.input.resource.index, request.input.resource.collection, request.input.body || {}, request.input.resource._id);

    if (rooms.length > 0) {
      const notificationContent = {_source: request.input.body, _id: request.input.resource._id};

      if (request.input.controller === 'document' || request.input.controller === 'realtime') {
        notificationContent.state = 'pending';

        if (request.input.action === 'publish') {
          notificationContent.state = 'done';
          notificationContent.scope = 'in';
        }
        else if (['create', 'createOrReplace', 'replace'].indexOf(request.input.action) !== -1) {
          /*
           since we have the complete document, we use the cache to avoid performing another dsl.test when
           notifying about document creations
           */
          this.kuzzle.services.list.internalCache.add(this.cacheKeyPrefix + request.id, rooms)
            .then(() => this.kuzzle.services.list.internalCache.expire(this.cacheKeyPrefix + request.id, 10));
        }
      }

      this.notify(rooms, request, notificationContent);
    }

    return { published: true };
  }


  /**
   * Notify rooms that a newly created document entered their scope
   *
   * @param {Request} request
   * @param {object} newDocument - the newly created document
   */
  notifyDocumentCreate(request, newDocument) {
    return this.kuzzle.services.list.internalCache.search(this.cacheKeyPrefix + request.id)
      .then(rooms => {
        const _meta = newDocument._source._kuzzle_info;
        delete newDocument._source._kuzzle_info;

        const notification = {
          _meta,
          _source: newDocument._source,
          _id: newDocument._id,
          action: 'create',
          state: 'done',
          scope: 'in'
        };

        this.notify(rooms, request, notification);
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
   */
  notifyDocumentReplace(request) {
    let matchedRooms;

    return this.kuzzle.services.list.internalCache.search(this.cacheKeyPrefix + request.id)
      .then(rooms => {
        const _meta = request.input.body._kuzzle_info;
        delete request.input.body._kuzzle_info;

        const notification = {
          _meta,
          _source: request.input.body,
          _id: request.input.resource._id,
          action: 'update',
          scope: 'in',
          state: 'done'
        };

        matchedRooms = rooms;
        this.notify(rooms, request, notification);

        return this.kuzzle.services.list.internalCache.search(this.cacheKeyPrefix + request.input.resource._id);
      })
      .then(cachedRooms => {
        const
          stopListening = _.difference(cachedRooms, matchedRooms),
          notification = {
            _id: request.input.resource._id,
            action: 'update',
            scope: 'out',
            state: 'done'
          };

        this.notify(stopListening, request, notification);

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
  notifyDocumentUpdate(request) {
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

        matchedRooms = this.kuzzle.dsl.test(
          request.input.resource.index,
          request.input.resource.collection,
          result._source,
          result._id);

        const _meta = updatedDocument._source._kuzzle_info;
        delete updatedDocument._source._kuzzle_info;

        this.notify(matchedRooms, request, {
          _meta,
          action: 'update',
          _id: updatedDocument._id,
          _source: updatedDocument._source,
          scope: 'in',
          state: 'done'
        });

        return this.kuzzle.services.list.internalCache.search(this.cacheKeyPrefix + updatedDocument._id);
      })
      .then(cachedRooms => {
        const
          stopListening = _.difference(cachedRooms, matchedRooms);

        this.notify(stopListening, request, {
          action: 'update',
          _id: updatedDocument._id,
          scope: 'out',
          state: 'done'
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
  notifyDocumentDelete(request, ids) {
    return Bluebird.each(ids, (id, callback) => {
      const
        getRequest = new Request({
          action: 'delete',
          controller: 'document',
          collection: request.input.resource.collection,
          index: request.input.resource.index,
          _id: id,
          requestId: request.id,
          volatile: request.input.volatile
        });

      getRequest.input.args.includeTrash = true;

      return this.kuzzle.services.list.storageEngine.get(getRequest)
        .then(result => {
          const deletedDocument = result;

          const matchedRooms = this.kuzzle.dsl.test(
            request.input.resource.index,
            request.input.resource.collection,
            result._source,
            result._id);

          const _meta = deletedDocument._source._kuzzle_info;
          delete deletedDocument._source._kuzzle_info;

          this.notify(matchedRooms, request, {
            _meta,
            action: 'delete',
            _id: deletedDocument._id,
            scope: 'out',
            state: 'done'
          });

          return this.kuzzle.services.list.internalCache.search(this.cacheKeyPrefix + deletedDocument._id)
            .asCallback(callback);
        })
        .then(cachedRooms => {
          const
            notification = {
              action: 'delete',
              scope: 'out',
              state: 'done',
              _id: id
            };

          this.kuzzle.notifier.notify(cachedRooms, request, notification);
          return this.kuzzle.services.list.internalCache.remove(this.cacheKeyPrefix + id);
        })
        .asCallback(callback);
    }, error => {
      if (error) {
        this.kuzzle.pluginsManager.trigger('log:error', error);
        return false;
      }
    });
  }
}

module.exports = NotifierController;
