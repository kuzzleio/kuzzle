var
  _ = require('lodash'),
  Promise = require('bluebird'),
  NotificationObject = require('./models/notificationObject'),
  RequestObject = require('kuzzle-common-objects').Models.requestObject;

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

  this.init = function () {
  };

  /**
   * Notify rooms with a data object. Invoked directly by kuzzle
   * core components
   *
   * Notify by sending the message data on all corresponding channels
   * If no connection ID is provided, broadcasts the message on all users connected to the channels
   *
   * @param {Array} rooms - list of rooms to notify
   * @param {RequestObject} requestObject - the source request causing the notification
   * @param {Object} content - the content of the notification (see NotificationObject constructor)
   * @param {string} [connectionId]
   */
  this.notify = function (rooms, requestObject, content, connectionId) {
    var
      eventName = connectionId ? 'notify' : 'broadcast',
      notification,
      channels = [],
      data;

    if (!rooms || rooms.length === 0) {
      return false;
    }

    notification = new NotificationObject(rooms.length > 1 ? 'Multiple rooms' : rooms[0], requestObject, content);

    rooms.forEach(room => kuzzle.hotelClerk.addToChannels(channels, room, notification));

    if (channels.length > 0) {
      data = {
        payload: notification.toJson(),
        channels: channels,
        id: connectionId
      };

      kuzzle.entryPoints.proxy.dispatch(eventName, data);
      kuzzle.pluginsManager.trigger('proxy:' + eventName, data);
    }

    return true;
  };

  /**
   * Notify subscribed users with a realtime message
   *
   * @param requestObject
   */
  this.publish = function (requestObject) {
    var
      rooms,
      notificationContent = {_source: requestObject.data.body, _id: requestObject.data._id};

    rooms = kuzzle.dsl.test(requestObject.index, requestObject.collection, requestObject.data.body, requestObject.data._id);

    if (rooms.length > 0) {
      if (requestObject.controller === 'write') {
        notificationContent.state = 'pending';

        if (requestObject.action === 'publish') {
          notificationContent.state = 'done';
          notificationContent.scope = 'in';
        }
        else if (['create', 'createOrReplace', 'replace'].indexOf(requestObject.action) !== -1) {
          /*
           since we have the complete document, we use the cache to avoid performing another dsl.test when
           notifying about document creations
           */
          kuzzle.services.list.internalCache.add(this.cacheKeyPrefix + requestObject.requestId, rooms)
            .then(() => kuzzle.services.list.internalCache.expire(this.cacheKeyPrefix + requestObject.requestId, 10));
        }
      }

      this.notify(rooms, requestObject, notificationContent);
    }

    return { published: true };
  };


  /**
   * Notify rooms that a newly created document entered their scope
   *
   * @param {RequestObject} requestObject object describing the original user request
   * @param {Object} newDocument - the newly created document
   */
  this.notifyDocumentCreate = function (requestObject, newDocument) {
    return kuzzle.services.list.internalCache.search(this.cacheKeyPrefix + requestObject.requestId)
      .then(rooms => {
        var notification = {
          _source: newDocument._source,
          _id: newDocument._id,
          action: 'create',
          state: 'done',
          scope: 'in'
        };

        this.notify(rooms, requestObject, notification);
        return kuzzle.services.list.internalCache.add(this.cacheKeyPrefix + newDocument._id, rooms);
      })
      .catch(error => kuzzle.pluginsManager.trigger('log:error', error));
  };

  /**
   * Notify rooms that, either :
   *    - an updated document is now in their scope
   *    - a document they listened to left their scope
   *
   * @param {RequestObject} requestObject object describing the original user request
   */
  this.notifyDocumentReplace = function (requestObject) {
    var
      matchedRooms;

    return kuzzle.services.list.internalCache.search(this.cacheKeyPrefix + requestObject.requestId)
      .then((rooms) => {
        var notification = {
          _source: requestObject.data.body,
          _id: requestObject.data._id,
          action: 'update',
          scope: 'in',
          state: 'done'
        };

        matchedRooms = rooms;
        this.notify(rooms, requestObject, notification);

        return kuzzle.services.list.internalCache.search(this.cacheKeyPrefix + requestObject.data._id);
      })
      .then((cachedRooms) => {
        var
          stopListening = _.difference(cachedRooms, matchedRooms),
          notification = {
            _id: requestObject.data._id,
            action: 'update',
            scope: 'out',
            state: 'done'
          };

        this.notify(stopListening, requestObject, notification);

        return kuzzle.services.list.internalCache.remove(this.cacheKeyPrefix + requestObject.data._id, stopListening);
      })
      .then(() => kuzzle.services.list.internalCache.add(this.cacheKeyPrefix + requestObject.data._id, matchedRooms))
      .catch(error => kuzzle.pluginsManager.trigger('log:error', error));
  };

  /**
   * Notify rooms that, either :
   *    - an updated document is now in their scope
   *    - a document they listened to left their scope
   *
   * @param {RequestObject} requestObject object describing the original user request
   */
  this.notifyDocumentUpdate = function (requestObject) {
    var
      matchedRooms,
      updatedDocument,
      request = {
        action: 'update',
        controller: 'write',
        collection: requestObject.collection,
        index: requestObject.index,
        _id: requestObject.data._id,
        requestId: requestObject.requestId,
        metadata: requestObject.metadata
      };

    return kuzzle.services.list.storageEngine.get(new RequestObject(request))
      .then(result => {
        updatedDocument = result;

        matchedRooms = kuzzle.dsl.test(
          requestObject.index,
          requestObject.collection,
          result._source,
          result._id);

        this.notify(matchedRooms, requestObject, {
          action: 'update',
          _id: updatedDocument._id,
          _source: updatedDocument._source,
          scope: 'in',
          state: 'done'
        });

        return kuzzle.services.list.internalCache.search(this.cacheKeyPrefix + updatedDocument._id);
      })
      .then(cachedRooms => {
        var
          stopListening = _.difference(cachedRooms, matchedRooms);

        this.notify(stopListening, requestObject, {
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
   * @param {RequestObject} requestObject object describing the original user request
   * @param {Array} ids - list of deleted document IDs
   */
  this.notifyDocumentDelete = function (requestObject, ids) {
    return Promise.each(ids, (id, callback) => {
      return kuzzle.services.list.internalCache.search(this.cacheKeyPrefix + id)
        .then(cachedRooms => {
          var
            notification = {
              action: 'delete',
              scope: 'out',
              state: 'done',
              _id: id
            };

          kuzzle.notifier.notify(cachedRooms, requestObject, notification);
          return kuzzle.services.list.internalCache.remove(this.cacheKeyPrefix + id);
        })
        .asCallback(callback);
    }, (error) => {
      if (error) {
        kuzzle.pluginsManager.trigger('log:error', error);
        return false;
      }
    });
  };
}

module.exports = NotifierController;
