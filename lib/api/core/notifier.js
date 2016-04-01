var
  _ = require('lodash'),
  q = require('q'),
  ResponseObject = require('./models/responseObject'),
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
   * @param rooms
   * @param {Object} response
   * @param {string} connectionId
   * @returns {boolean}
   */
  this.notify = function (rooms, response, connectionId) {
    if (!rooms) {
      return false;
    }

    if (!Array.isArray(rooms)) {
      rooms = [rooms];
    }

    async.each(rooms, function (roomName) {
      send.call(kuzzle, roomName, response, connectionId);
    });
  };

  /**
   * Notify subscribed users with a realtime message
   *
   * @param requestObject
   */
  this.publish = function (requestObject) {
    var
      response = new ResponseObject(requestObject, {_source: requestObject.data.body});

    return kuzzle.dsl.testFilters(response)
      .then(rooms => {
        if (!_.isEmpty(rooms)) {
          if (response.controller === 'write') {
            if (response.action === 'publish') {
              response.state = 'done';
              response.scope = 'in';
            }
            else if (response.action === 'create' || response.action === 'createOrReplace' || response.action === 'replace') {
              /*
               since we have the complete document, we use the cache to avoid performing another testFilter when
               notifying about document creations
               */
              kuzzle.services.list.notificationCache.add(response.requestId, rooms)
                .then(() => kuzzle.services.list.notificationCache.expire(response.requestId, 10));
            }
          }

          this.notify(rooms, response.toJson());
        }
      });
  };


  /**
   * Notify rooms that a newly created document entered their scope
   *
   * @param {ResponseObject} responseObject object describing the response from writeEngine
   */
  this.notifyDocumentCreate = function (responseObject) {
    kuzzle.services.list.notificationCache.search(responseObject.requestId)
      .then(rooms => {
        var response = responseObject.toJson();
        response.action = 'create';
        response.scope = 'in';
        this.notify(rooms, response);
        return kuzzle.services.list.notificationCache.add(responseObject.data.body._id, rooms);
      })
      .catch(error => kuzzle.pluginsManager.trigger('log:error', error));
  };

  /**
   * Notify rooms that, either :
   *    - an updated document is now in their scope
   *    - a document they listened to left their scope
   *
   * @param {ResponseObject} responseObject object describing the document response from writeEngine
   */
  this.notifyDocumentReplace = function (responseObject) {
    var
      matchedRooms;

    kuzzle.services.list.notificationCache.search(responseObject.requestId)
      .then((rooms) => {
        var jsonResponseObject;
        matchedRooms = rooms;
        jsonResponseObject = responseObject.toJson();
        jsonResponseObject.scope = 'in';
        jsonResponseObject.action = 'update';

        this.notify(matchedRooms, jsonResponseObject);

        return kuzzle.services.list.notificationCache.search(responseObject.data.body._id);
      })
      .then((cachedRooms) => {
        var
          stopListening = _.difference(cachedRooms, matchedRooms),
          leftScopeResponse = responseObject.toJson(['body', '_source']);
        leftScopeResponse.scope = 'out';
        leftScopeResponse.action = 'update';

        this.notify(stopListening, leftScopeResponse);

        return kuzzle.services.list.notificationCache.remove(responseObject.data.body._id, stopListening);
      })
      .then(() => {
        return kuzzle.services.list.notificationCache.add(responseObject.data.body._id, matchedRooms);
      })
      .catch(error => kuzzle.pluginsManager.trigger('log:error', error));
  };

  /**
   * Notify rooms that, either :
   *    - an updated document is now in their scope
   *    - a document they listened to left their scope
   *
   * @param {ResponseObject} responseObject object describing the document response from writeEngine
   */
  this.notifyDocumentUpdate = function (responseObject) {
    var
      matchedRooms,
      updateResponseObject,
      request;

    request = {
      action: 'update',
      controller: 'write',
      collection: responseObject.collection,
      index: responseObject.index,
      _id: responseObject.data.body._id,
      requestId: responseObject.requestId,
      metadata: responseObject.metadata
    };

    kuzzle.services.list.readEngine.get(new RequestObject(request))
      .then((result) => {
        updateResponseObject = result;
        updateResponseObject.scope = 'in';
        return kuzzle.dsl.testFilters(updateResponseObject);
      })
      .then((rooms) => {
        matchedRooms = rooms;
        this.notify(matchedRooms, updateResponseObject.toJson());

        return kuzzle.services.list.notificationCache.search(responseObject.data.body._id);
      })
      .then((cachedRooms) => {
        var
          stopListening = _.difference(cachedRooms, matchedRooms),
          leftScopeResponse = updateResponseObject.toJson(['body', '_source']);
        leftScopeResponse.scope = 'out';
        this.notify(stopListening, leftScopeResponse);

        return kuzzle.services.list.notificationCache.remove(updateResponseObject.data.body._id, stopListening);
      })
      .then(() => {
        return kuzzle.services.list.notificationCache.add(updateResponseObject.data.body._id, matchedRooms);
      })
      .catch(error => kuzzle.pluginsManager.trigger('log:error', error));
  };

  /**
   * Notify rooms that a document they listened to has been deleted
   *
   * @param {ResponseObject} responseObject object containing the document ID (or an array of IDs)
   */
  this.notifyDocumentDelete = function (responseObject) {
    var
      idList = [];

    if (responseObject.action === 'deleteByQuery') {
      idList = responseObject.data.body.ids;
      responseObject.action = 'delete';
    }
    else if (responseObject.data.body._id) {
      idList = [responseObject.data.body._id];
    }

    responseObject.scope = 'out';

    async.each(idList, (id, callback) => {
      kuzzle.services.list.notificationCache.search(id)
        .then(function (cachedRooms) {
          responseObject.data.body._id = id;
          kuzzle.notifier.notify(cachedRooms, responseObject.toJson(['body']));

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
 * @param {String} room
 * @param {object} responseObject
 * @param {String} [connectionId] - ID of the connection to send the message
 */
function send (room, responseObject, connectionId) {
  var
    eventName;

  if (connectionId) {
    eventName = 'protocol:notify';
  } else {
    eventName = 'protocol:broadcast';
  }

  this.hotelClerk.getChannels(room, responseObject).forEach(channel => {
    var data = {payload: responseObject, channel};

    if (connectionId) {
      data.id = connectionId;
    }

    this.pluginsManager.trigger(eventName, data);
    this.services.list.mqBroker.addExchange(channel, responseObject);
  });
}

/**
 * Listens to the internal broker for notification messages from workers.
 * Notify rooms on a document creation/update/deletion
 *
 * @param {Object} serializedResponseObject
 */
function workerNotification (serializedResponseObject) {
  var responseObject = ResponseObject.prototype.unserialize(serializedResponseObject);
  var action = {
    create: notifyDocumentCreate,
    createOrReplace: (responseObject.data && responseObject.data.created) ? notifyDocumentCreate : notifyDocumentUpdate,
    update: notifyDocumentUpdate,
    replace: notifyDocumentReplace,
    delete: notifyDocumentDelete,
    deleteByQuery: notifyDocumentDelete
  };

  if (action[responseObject.action]) {
    action[responseObject.action].call(this, responseObject)
      .catch(function (error) {
        this.pluginsManager.trigger('log:error', error);
      }.bind(this));
  }
}
