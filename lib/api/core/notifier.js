var
  _ = require('lodash'),
  NotificationObject = require('./models/notificationObject'),
  RequestObject = require('./models/requestObject'),
  async = require('async');

/**
 * This internal service can either be invoked directly by
 * Kuzzle internal components, or through the internal
 * broker. This second way of communication is used
 * by workers to notify rooms about their work.
 */
module.exports = function NotifierController (kuzzle) {
  this.init = function () {
  };

  /**
   * Notify rooms with a data object. Invoked directly by kuzzle
   * core components
   *
   * @param {string|Array} rooms - list of rooms to notify
   * @param {RequestObject} requestObject - the source request causing the notification
   * @param {Object} content - the content of the notification (see NotificationObject constructor)
   * @param {string} connectionId
   * @returns {boolean}
   */
  this.notify = function (rooms, requestObject, content, connectionId) {
    if (!rooms) {
      return false;
    }

    if (!Array.isArray(rooms)) {
      rooms = [rooms];
    }

    async.each(rooms, function (roomName) {
      send.call(kuzzle, roomName, requestObject, content, connectionId);
    });
  };

  /**
   * Notify subscribed users with a realtime message
   *
   * @param requestObject
   */
  this.publish = function (requestObject) {
    return kuzzle.dsl.testFilters(requestObject.index, requestObject.collection, requestObject.data._id, requestObject.data.body)
      .then(rooms => {
        var notificationContent = {_source: requestObject.data.body, _id: requestObject.data._id};

        if (!_.isEmpty(rooms)) {
          if (requestObject.controller === 'write') {
            notificationContent.state = 'pending';

            if (requestObject.action === 'publish') {
              notificationContent.state = 'done';
              notificationContent.scope = 'in';
            }
            else if (['create', 'createOrReplace', 'replace'].indexOf(requestObject.action) !== -1) {
              /*
               since we have the complete document, we use the cache to avoid performing another testFilter when
               notifying about document creations
               */
              kuzzle.services.list.notificationCache.add(requestObject.requestId, rooms)
                .then(() => kuzzle.services.list.notificationCache.expire(requestObject.requestId, 10));
            }
          }

          this.notify(rooms, requestObject, notificationContent);
        }

        return { published: true };
      });
  };


  /**
   * Notify rooms that a newly created document entered their scope
   *
   * @param {RequestObject} requestObject object describing the original user request
   * @param {Object} newDocument - the newly created document
   */
  this.notifyDocumentCreate = function (requestObject, newDocument) {
    kuzzle.services.list.notificationCache.search(requestObject.requestId)
      .then(rooms => {
        var notification = {
          _source: newDocument._source,
          _id: newDocument._id,
          action: 'create',
          state: 'done',
          scope: 'in'
        };

        this.notify(rooms, requestObject, notification);
        return kuzzle.services.list.notificationCache.add(newDocument._id, rooms);
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

    kuzzle.services.list.notificationCache.search(requestObject.requestId)
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

        return kuzzle.services.list.notificationCache.search(requestObject.data._id);
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

        return kuzzle.services.list.notificationCache.remove(requestObject.data._id, stopListening);
      })
      .then(() => kuzzle.services.list.notificationCache.add(requestObject.data._id, matchedRooms))
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

    kuzzle.services.list.readEngine.get(new RequestObject(request))
      .then(result => {
        updatedDocument = result;

        return kuzzle.dsl.testFilters(
          requestObject.index,
          requestObject.collection,
          result._id,
          result._source);
      })
      .then(rooms => {
        matchedRooms = rooms;
        this.notify(matchedRooms, requestObject, {
          action: 'update',
          _id: updatedDocument._id,
          _source: updatedDocument._source,
          scope: 'in',
          state: 'done'
        });

        return kuzzle.services.list.notificationCache.search(updatedDocument._id);
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

        return kuzzle.services.list.notificationCache.remove(updatedDocument._id, stopListening);
      })
      .then(() => kuzzle.services.list.notificationCache.add(updatedDocument._id, matchedRooms))
      .catch(error => kuzzle.pluginsManager.trigger('log:error', error));
  };

  /**
   * Notify rooms that a document they listened to has been deleted
   *
   * @param {RequestObject} requestObject object describing the original user request
   * @param {Array} ids - list of deleted document IDs
   */
  this.notifyDocumentDelete = function (requestObject, ids) {
    async.each(ids, (id, callback) => {
      kuzzle.services.list.notificationCache.search(id)
        .then(function (cachedRooms) {
          var
            notification = {
              action: 'delete',
              scope: 'out',
              state: 'done',
              _id: id
            };
          
          kuzzle.notifier.notify(cachedRooms, requestObject, notification);
          return kuzzle.services.list.notificationCache.remove(id);
        })
        .then(() => callback())
        .catch((error) => callback(error));
    }, (error) => {
      if (error) {
        kuzzle.pluginsManager.trigger('log:error', error);
        return false;
      }
    });
  };
};

/**
 * Notify by sending the message data on all corresponding channels
 * If no connection ID is provided, broadcasts the message on all users connected to the channels
 *
 * @param {String} room to notify
 * @param {RequestObject} requestObject - the source request causing the notification
 * @param {Object} content - the content of the notification (see NotificationObject constructor)
 * @param {String} [connectionId] - ID of the connection to send the message
 */
function send (room, requestObject, content, connectionId) {
  var
    eventName,
    notification = new NotificationObject(room, requestObject, content);

  if (connectionId) {
    eventName = 'protocol:notify';
  } else {
    eventName = 'protocol:broadcast';
  }

  this.hotelClerk.getChannels(room, notification).forEach(channel => {
    var
      pluginData = {payload: notification.toJson(), channel};

    if (connectionId) {
      pluginData.id = connectionId;
    }

    this.pluginsManager.trigger(eventName, pluginData);
    this.services.list.mqBroker.addExchange(channel, notification.toJson());
  });
}
