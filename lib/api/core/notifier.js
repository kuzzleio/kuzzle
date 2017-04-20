var
  _ = require('lodash'),
  Promise = require('bluebird'),
  NotificationObject = require('./models/notificationObject'),
  Request = require('kuzzle-common-objects').Request;

/**
 * This internal service can either be invoked directly by
 * Kuzzle internal components, or through the internal
 * broker. This second way of communication is used
 * by workers to notify rooms about their work.
 *
 * @constructor
 */
function NotifierController (kuzzle) {

  this.cacheKeyPrefix = 'notif/';

  this.init = function notifierInit () {
  };

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
  this.notify = function notifierNotify (rooms, request, content, connectionId) {
    var
      eventName = connectionId ? 'notify' : 'broadcast',
      notification,
      channels = [],
      data;

    if (!rooms || rooms.length === 0) {
      return false;
    }

    notification = new NotificationObject(rooms.length > 1 ? 'Multiple rooms' : rooms[0], request, content);

    rooms.forEach(room => kuzzle.hotelClerk.addToChannels(channels, room, notification));

    if (channels.length > 0) {
      data = {
        payload: notification.toJson(),
        channels: channels,
        connectionId: connectionId
      };

      kuzzle.entryPoints.proxy.dispatch(eventName, data);
      kuzzle.pluginsManager.trigger('proxy:' + eventName, data);
    }

    return true;
  };

  /**
   * Notify subscribed users with a realtime message
   *
   * @param {Request} request
   */
  this.publish = function publish (request) {
    var
      rooms,
      notificationContent = {_source: request.input.body, _id: request.input.resource._id};

    rooms = kuzzle.dsl.test(request.input.resource.index, request.input.resource.collection, request.input.body || {}, request.input.resource._id);

    if (rooms.length > 0) {
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
          kuzzle.services.list.internalCache.add(this.cacheKeyPrefix + request.id, rooms)
            .then(() => kuzzle.services.list.internalCache.expire(this.cacheKeyPrefix + request.id, 10));
        }
      }

      this.notify(rooms, request, notificationContent);
    }

    return { published: true };
  };


  /**
   * Notify rooms that a newly created document entered their scope
   *
   * @param {Request} request
   * @param {object} newDocument - the newly created document
   */
  this.notifyDocumentCreate = function notifierNotifyDocumentCreate (request, newDocument) {
    return kuzzle.services.list.internalCache.search(this.cacheKeyPrefix + request.id)
      .then(rooms => {
        const _meta = newDocument._source._kuzzle_info;
        delete newDocument._source._kuzzle_info;

        const notification = {
          _source: newDocument._source,
          _meta,
          _id: newDocument._id,
          action: 'create',
          state: 'done',
          scope: 'in'
        };

        this.notify(rooms, request, notification);
        return kuzzle.services.list.internalCache.add(this.cacheKeyPrefix + newDocument._id, rooms);
      })
      .catch(error => kuzzle.pluginsManager.trigger('log:error', error));
  };

  /**
   * Notify rooms that, either :
   *    - an updated document is now in their scope
   *    - a document they listened to left their scope
   *
   * @param {Request} request - object describing the original user request
   */
  this.notifyDocumentReplace = function notifierNotifyDocumentReplace (request) {
    var matchedRooms;

    return kuzzle.services.list.internalCache.search(this.cacheKeyPrefix + request.id)
      .then((rooms) => {
        const _meta = request.input.body._kuzzle_info;
        delete request.input.body._kuzzle_info;

        const notification = {
          _source: request.input.body,
          _meta,
          _id: request.input.resource._id,
          action: 'update',
          scope: 'in',
          state: 'done'
        };

        matchedRooms = rooms;
        this.notify(rooms, request, notification);

        return kuzzle.services.list.internalCache.search(this.cacheKeyPrefix + request.input.resource._id);
      })
      .then((cachedRooms) => {
        const
          stopListening = _.difference(cachedRooms, matchedRooms),
          notification = {
            _id: request.input.resource._id,
            action: 'update',
            scope: 'out',
            state: 'done'
          };

        this.notify(stopListening, request, notification);

        return kuzzle.services.list.internalCache.remove(this.cacheKeyPrefix + request.input.resource._id, stopListening);
      })
      .then(() => kuzzle.services.list.internalCache.add(this.cacheKeyPrefix + request.input.resource._id, matchedRooms))
      .catch(error => kuzzle.pluginsManager.trigger('log:error', error));
  };

  /**
   * Notify rooms that, either :
   *    - an updated document is now in their scope
   *    - a document they listened to left their scope
   *
   * @param {Request} request
   */
  this.notifyDocumentUpdate = function notifierNotifyDocumentUpdate (request) {
    var
      matchedRooms,
      updatedDocument,
      getRequest = new Request({
        action: 'update',
        controller: 'document',
        collection: request.input.resource.collection,
        index: request.input.resource.index,
        _id: request.input.resource._id,
        requestId: request.id,
        volatile: request.input.volatile
      });

    return kuzzle.services.list.storageEngine.get(getRequest)
      .then(result => {
        updatedDocument = result;

        matchedRooms = kuzzle.dsl.test(
          request.input.resource.index,
          request.input.resource.collection,
          result._source,
          result._id);

        const _meta = updatedDocument._source._kuzzle_info;
        delete updatedDocument._source._kuzzle_info;

        this.notify(matchedRooms, request, {
          action: 'update',
          _id: updatedDocument._id,
          _source: updatedDocument._source,
          _meta,
          scope: 'in',
          state: 'done'
        });

        return kuzzle.services.list.internalCache.search(this.cacheKeyPrefix + updatedDocument._id);
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

        return kuzzle.services.list.internalCache.remove(this.cacheKeyPrefix + updatedDocument._id, stopListening);
      })
      .then(() => kuzzle.services.list.internalCache.add(this.cacheKeyPrefix + updatedDocument._id, matchedRooms))
      .catch(error => kuzzle.pluginsManager.trigger('log:error', error));
  };

  /**
   * Notify rooms that a document they listened to has been deleted
   *
   * @param {Request} request
   * @param {Array} ids - list of deleted document IDs
   */
  this.notifyDocumentDelete = function notifierNotifyDocumentDelete (request, ids) {
    return Promise.each(ids, (id, callback) => {
      var
        matchedRooms,
        deletedDocument,
        getRequest = new Request({
          action: 'delete',
          controller: 'document',
          collection: request.input.resource.collection,
          index: request.input.resource.index,
          _id: id,
          requestId: request.id,
          volatile: request.input.volatile || {}
        });

      getRequest.input.volatile.includeTrash = true;

      return kuzzle.services.list.storageEngine.get(getRequest)
        .then(result => {
          deletedDocument = result;

          matchedRooms = kuzzle.dsl.test(
            request.input.resource.index,
            request.input.resource.collection,
            result._source,
            result._id);

          const _meta = deletedDocument._source._kuzzle_info;
          delete deletedDocument._source._kuzzle_info;

          this.notify(matchedRooms, request, {
            action: 'delete',
            _id: deletedDocument._id,
            _source: deletedDocument._source,
            _meta,
            scope: 'out',
            state: 'done'
          });

          return kuzzle.services.list.internalCache.search(this.cacheKeyPrefix + deletedDocument._id)
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

          kuzzle.notifier.notify(cachedRooms, request, notification);
          return kuzzle.services.list.internalCache.remove(this.cacheKeyPrefix + id);
        });
    }, (error) => {
      if (error) {
        kuzzle.pluginsManager.trigger('log:error', error);
        return false;
      }
    });
  };
}

module.exports = NotifierController;
