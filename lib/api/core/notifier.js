var
  _ = require('lodash'),
  q = require('q'),
  ResponseObject = require('./models/responseObject'),
  RequestObject = require('./models/requestObject'),
  async = require('async');

module.exports = function NotifierController (kuzzle) {
  /**
   * This internal service can either be invoked directly by
   * Kuzzle internal components, or through the internal
   * message broker. This second way of communication is used
   * by workers to notify rooms of their work.
   */
  this.taskQueue = 'core-notifier-queue';


  this.init  = function (kuzzle) {
    kuzzle.services.list.broker.listen(this.taskQueue, workerNotification.bind(kuzzle));
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
 * If socket is defined, we send the event only on this socket,
 * otherwise, we send to all sockets on the room
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
        this.services.list.broker.replyTo(connection.id, response);
        break;
      case 'mqtt':
        this.services.list.broker.addExchange(connection.id, response);
        break;
    }
  }
  else {
    this.io.emit(room, response);
    this.services.list.broker.addExchange(room, response);
  }
}


/**
 * Listens to the message broker for notification messages from workers.
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
 * @param {Object} [connection] type
 * @return {Promise} number of notified rooms
 */
function notifyDocumentCreate (responseObject, connection) {
  var
    notifiedRooms = 0,
    deferred = q.defer();

  this.dsl.testFilters(responseObject)
    .then(function (rooms) {
      notifiedRooms += rooms.length;
      this.notifier.notify(rooms, responseObject.toJson(), connection);
      return this.services.list.notificationCache.add(responseObject.data._id, rooms);
    }.bind(this))
    .then(function () {
    deferred.resolve(notifiedRooms);
  })
    .catch(function (error) {
      this.log.error(error);
      deferred.reject(error);
    }.bind(this));

  return deferred.promise;
}

/**
 * Notify rooms that, either :
 *    - an updated document is now in their scope
 *    - a document they listened to left their scope
 *
 * @param {ResponseObject} responseObject object describing the document response from writeEngine
 * @param {Object} [connection] type
 * @return {Promise} number of notified rooms
 */
function notifyDocumentUpdate (responseObject, connection) {
  var
    notifiedRooms = 0,
    matchedRooms,
    updateResponseObject,
    request,
    deferred = q.defer();

  request = {
    action: 'update',
    controller: 'write',
    collection: responseObject.collection,
    _id: responseObject.data._id
  };

  this.services.list.readEngine.get(new RequestObject(request))
    .then(function (result) {
      updateResponseObject = result;
      updateResponseObject.addBody();

      return this.dsl.testFilters(updateResponseObject);
    }.bind(this))
    .then(function (rooms) {
      matchedRooms = rooms;
      this.notifier.notify(matchedRooms, updateResponseObject.toJson(), connection);
      notifiedRooms += rooms.length;

      return this.services.list.notificationCache.search(responseObject.data._id);
    }.bind(this))
    .then(function (cachedRooms) {
      var stopListening = _.difference(cachedRooms, matchedRooms);

      this.notifier.notify(stopListening, responseObject.toJson(['body', '_source']), connection);
      notifiedRooms += stopListening.length;

      return this.services.list.notificationCache.remove(updateResponseObject.data._id, stopListening);
    }.bind(this))
    .then(function () {
      return this.services.list.notificationCache.add(updateResponseObject.data._id, matchedRooms);
    }.bind(this))
    .then(function () {
      deferred.resolve(notifiedRooms);
    })
    .catch(function (error) {
      deferred.reject(error);
    }.bind(this));

  return deferred.promise;
}

/**
 * Notify rooms that a document they listened to has been deleted
 *
 * @param {ResponseObject} responseObject object containing the document ID (or an array of IDs)
 * @param {Object} [connection] type
 * @return {Promise} number of notified rooms
 */
function notifyDocumentDelete (responseObject, connection) {
  var
    deferred = q.defer(),
    notifiedRooms = 0,
    idList;

  if (responseObject.action === 'deleteByQuery') {
    idList = responseObject.data.ids;
    responseObject.action = 'delete';
  }
  else {
    idList = [responseObject.data._id];
  }

  async.each(idList, function (id, callback) {
      this.services.list.notificationCache.search(id)
        .then(function (cachedRooms) {
          notifiedRooms += cachedRooms.length;
          responseObject.data._id = id;
          this.notifier.notify(cachedRooms, responseObject.toJson(['body']), connection);

          return this.services.list.notificationCache.remove(id);
        }.bind(this))
        .then(callback())
        .catch(function (error) {
          this.log.error(error);
          callback(error);
        }.bind(this));
    }.bind(this), function (error) {
      if (error) {
        deferred.reject(error);
        return false;
      }

      deferred.resolve(notifiedRooms);
    }
  );

  return deferred.promise;
}
