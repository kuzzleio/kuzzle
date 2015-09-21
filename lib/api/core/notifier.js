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
  this.init  = function (kuzzle) {
    kuzzle.services.list.broker.listen(kuzzle.config.queues.coreNotifierTaskQueue, workerNotification.bind(kuzzle));
  };

  /**
   * Notify rooms with a data object. Invoked directly by kuzzle
   * core components
   *
   * @param rooms
   * @param {Object} response
   * @param connection
   * @returns {boolean}
   */
  this.notify = function (rooms, response, connection) {
    if (!rooms) {
      return false;
    }

    if (!Array.isArray(rooms)) {
      rooms = [rooms];
    }

    async.each(rooms, function (roomName) {
      send.call(kuzzle, roomName, response, connection);
    }.bind(this));
  };

};

/**
 * Notify by message data on the request Id channel
 * If the connection argument is defined, the event is sent directly to that connection.
 * Otherwise, it is broadcasted to all of this room's listeners
 *
 * @param {String} room
 * @param {object} response
 * @param {Object} connection
 */
function send (room, response, connection) {
  if (connection) {
    switch (connection.type) {
      case 'websocket':
        this.io.to(connection.id).emit(room, response);
        break;
      case 'amq':
        this.services.list.mqBroker.replyTo(connection.replyTo, response);
        break;
      case 'mqtt':
        this.services.list.mqBroker.addExchange(connection.replyTo, response);
        break;
      case 'rest':
        connection.response.end(JSON.stringify(response));
        break;
    }
  }
  else {
    if (this.io) {
      this.io.to(room).emit(room, response);
    }

    this.services.list.mqBroker.addExchange(room, response);
  }
}

/**
 * Listens to the internal broker for notification messages from workers.
 * Notify rooms on a document creation/update/deletion
 *
 * @param {Object} serializedResponseObject
 */
function workerNotification (serializedResponseObject) {
  var action = {
    create: notifyDocumentCreate,
    update: notifyDocumentUpdate,
    delete: notifyDocumentDelete,
    deleteByQuery: notifyDocumentDelete
  };

  var responseObject = ResponseObject.prototype.unserialize(serializedResponseObject);

  if (action[responseObject.action]) {
    action[responseObject.action].call(this, responseObject)
      .catch(function (error) {
        this.log.error(error, '\nRejected response object:\n', responseObject);
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

  this.dsl.testFilters(responseObject)
    .then(function (rooms) {
      this.notifier.notify(rooms, responseObject.toJson());
      return this.services.list.notificationCache.add(responseObject.data._id, rooms);
    }.bind(this))
    .then(function () {
      deferred.resolve({});
    })
    .catch(function (error) {
      deferred.reject(error);
    });

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
    _id: responseObject.data._id
  };

  self.services.list.readEngine.get(new RequestObject(request))
    .then(function (result) {
      updateResponseObject = result;
      updateResponseObject.addBody();

      return self.dsl.testFilters(updateResponseObject);
    })
    .then(function (rooms) {
      matchedRooms = rooms;
      self.notifier.notify(matchedRooms, updateResponseObject.toJson());

      return self.services.list.notificationCache.search(responseObject.data._id);
    })
    .then(function (cachedRooms) {
      var stopListening = _.difference(cachedRooms, matchedRooms);

      self.notifier.notify(stopListening, responseObject.toJson(['body', '_source']));

      return self.services.list.notificationCache.remove(updateResponseObject.data._id, stopListening);
    })
    .then(function () {
      return self.services.list.notificationCache.add(updateResponseObject.data._id, matchedRooms);
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
    idList = responseObject.data.ids;
    responseObject.action = 'delete';
  }
  else if (responseObject.data._id) {
    idList = [responseObject.data._id];
  }

  async.each(idList, function (id, callback) {
    self.services.list.notificationCache.search(id)
      .then(function (cachedRooms) {
        responseObject.data._id = id;
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
