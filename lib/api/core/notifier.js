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
    kuzzle.services.list.broker.listen(kuzzle.config.queues.coreNotifierTaskQueue, workerNotification.bind(kuzzle));
  };

  /**
   * Notify rooms with a data object. Invoked directly by kuzzle
   * core components
   *
   * @param rooms
   * @param {Object} response
   * @returns {boolean}
   */
  this.notify = function (rooms, response) {
    if (!rooms) {
      return false;
    }

    if (!Array.isArray(rooms)) {
      rooms = [rooms];
    }

    async.each(rooms, function (roomName) {
      send.call(kuzzle, roomName, response);
    });
  };

  /**
   * Notify subscribed users with a realtime message
   *
   * @param requestObject
   */
  this.publish = function (requestObject) {
    var
      deferred = q.defer(),
      response = new ResponseObject(requestObject, {_source: requestObject.data.body});

    kuzzle.dsl.testFilters(response)
      .then(rooms => {
        if (!_.isEmpty(rooms)) {
          if (response.controller === 'write') {
            if (response.action === 'publish') {
              response.state = 'done';
            }
            else if (response.action === 'create' || response.action === 'createOrUpdate') {
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
        deferred.resolve(response);
      })
      .catch(error => deferred.reject(error));

    return deferred.promise;
  };
};

/**
 * Notify by broadcasting the message data on all corresponding channels
 *
 * @param {String} room
 * @param {object} responseObject
 */
function send (room, responseObject) {
  this.hotelClerk.getChannels(room, responseObject).forEach(channel => {
    this.pluginsManager.trigger('protocol:broadcast', {channel, payload: responseObject});
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
    createOrUpdate: (responseObject.data && responseObject.data.created) ? notifyDocumentCreate : notifyDocumentUpdate,
    update: notifyDocumentUpdate,
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

/**
 * Notify rooms that a newly created document entered their scope
 *
 * @param {ResponseObject} responseObject object describing the response from writeEngine
 * @return {Promise} number of notified rooms
 */
function notifyDocumentCreate (responseObject) {
  var
    deferred = q.defer();

  this.services.list.notificationCache.search(responseObject.requestId)
    .then(rooms => {
      var response = responseObject.toJson();
      response.result.action = 'create';
      response.result.scope = 'in';
      this.notifier.notify(rooms, response);
      return this.services.list.notificationCache.add(responseObject.data.body._id, rooms);
    })
    .then(() => deferred.resolve({}))
    .catch(error => deferred.reject(error));

  return deferred.promise;
}

/**
 * Notify rooms that, either :
 *    - an updated document is now in their scope
 *    - a document they listened to left their scope
 *
 * @param {ResponseObject} responseObject object describing the document response from writeEngine
 * @return {Promise} number of notified rooms
 */
function notifyDocumentUpdate (responseObject) {
  var
    matchedRooms,
    updateResponseObject,
    request,
    deferred = q.defer(),
    self = this;

  request = {
    action: 'update',
    controller: 'write',
    collection: responseObject.collection,
    index: responseObject.index,
    _id: responseObject.data.body._id,
    requestId: responseObject.requestId,
    metadata: responseObject.metadata
  };

  self.services.list.readEngine.get(new RequestObject(request))
    .then(function (result) {
      updateResponseObject = result;
      updateResponseObject.scope = 'in';
      return self.dsl.testFilters(updateResponseObject);
    })
    .then(function (rooms) {
      matchedRooms = rooms;
      self.notifier.notify(matchedRooms, updateResponseObject.toJson());

      return self.services.list.notificationCache.search(responseObject.data.body._id);
    })
    .then(function (cachedRooms) {
      var
        stopListening = _.difference(cachedRooms, matchedRooms),
        leftScopeResponse = updateResponseObject.toJson(['body', '_source']);
      leftScopeResponse.result.scope = 'out';
      self.notifier.notify(stopListening, leftScopeResponse);

      return self.services.list.notificationCache.remove(updateResponseObject.data.body._id, stopListening);
    })
    .then(function () {
      return self.services.list.notificationCache.add(updateResponseObject.data.body._id, matchedRooms);
    })
    .then(function () {
      deferred.resolve({});
    })
    .catch(function (error) {
      deferred.reject(error);
    });

  return deferred.promise;
}

/**
 * Notify rooms that a document they listened to has been deleted
 *
 * @param {ResponseObject} responseObject object containing the document ID (or an array of IDs)
 * @return {Promise} number of notified rooms
 */
function notifyDocumentDelete (responseObject) {
  var
    deferred = q.defer(),
    idList = [],
    self = this;

  if (responseObject.action === 'deleteByQuery') {
    idList = responseObject.data.body.ids;
    responseObject.action = 'delete';
  }
  else if (responseObject.data.body._id) {
    idList = [responseObject.data.body._id];
  }

  responseObject.scope = 'out';

  async.each(idList, function (id, callback) {
    self.services.list.notificationCache.search(id)
      .then(function (cachedRooms) {
        responseObject.data.body._id = id;
        self.notifier.notify(cachedRooms, responseObject.toJson(['body']));

        return self.services.list.notificationCache.remove(id);
      })
      .then(function () {
        callback();
      })
      .catch(function (error) {
        callback(error);
      });
  }, function (error) {
    if (error) {
      deferred.reject(error);
      return false;
    }
    deferred.resolve({});
  });

  return deferred.promise;
}
