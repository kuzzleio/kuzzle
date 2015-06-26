var
  _ = require('lodash'),
  q = require('q'),
  async = require('async');

module.exports = function NotifierController (kuzzle) {

  this.notify = function (rooms, data, connection) {
    if (!rooms) {
      return false;
    }

    if (!Array.isArray(rooms)) {
      rooms = [rooms];
    }

    async.each(rooms, function (roomName) {
      send.call(kuzzle, roomName, data, connection);
    }.bind(this));
  };


  /**
   * Notify rooms on a document creation/update/deletion
   *
   * @param {Object} data
   * @param {Object} [connection]
   * @returns {Promise} number of notified rooms
   */
  this.documentChanged = function (data, connection) {
    switch (data.action) {
      case 'create':
        return notifyDocumentCreate.call(kuzzle, data, connection);
      case 'update':
        return notifyDocumentUpdate.call(kuzzle, data, connection);
      case 'delete':
      case 'deleteByQuery':
        return notifyDocumentDelete.call(kuzzle, data, connection);
    }
  };
};

/**
 * Notify by message data on the request Id channel
 * If socket is defined, we send the event only on this socket,
 * otherwise, we send to all sockets on the room
 *
 * @param {String} room
 * @param {Object} data
 * @param {Object} connection
 */
function send (room, data, connection) {
  if (connection) {
    switch (connection.type) {
      case 'websocket':
        this.io.to(connection.id).emit(room, data);
        break;
      case 'amq':
        this.services.list.broker.replyTo(connection.id, data);
        break;
      case 'mqtt':
        this.services.list.broker.addExchange(connection.id, data);
        break;
    }
  }
  else {
    this.io.emit(room, data);
    this.services.list.broker.addExchange(room, data);
  }
}


/**
 * Notify rooms that a newly created document entered their scope
 *
 * @param {Object} data object describing the document
 * @param {Object} [connection] type
 * @return {Promise} number of notified rooms
 */
function notifyDocumentCreate (data, connection) {
  var
    notifiedRooms = 0,
    deferred = q.defer();

    this.dsl.testFilters(data)
    .then(function (rooms) {
      notifiedRooms += rooms.length;
      this.notifier.notify(rooms, data, connection);
      return this.services.list.notificationCache.add(data._id, rooms);
    }.bind(this))
    .then (function () {
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
 *    - a newly created document entered their scope
 *    - a document they listened to left their scope
 *
 * @param {Object} data object describing the document
 * @param {Object} [connection] type
 * @return {Promise} number of notified rooms
 */
function notifyDocumentUpdate (data, connection) {
  var
    clonedData = _.clone(data),
    notifiedRooms = 0,
    deferred = q.defer();

  delete clonedData.body;

  this.dsl.testFilters(data)
    .then(function (rooms) {
      this.notifier.notify(rooms, data, connection);
      notifiedRooms += rooms.length;

      this.services.list.notificationCache.search(data._id)
        .then(function (cachedRooms) {
          var stopListening = _.difference(cachedRooms, rooms);
          this.notifier.notify(stopListening, clonedData, connection);
          notifiedRooms += stopListening.length;

          return this.services.list.notificationCache.remove(data._id, stopListening)
            .then(this.services.list.notificationCache.add(data._id, rooms));
        }.bind(this));
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
 * Notify rooms that a document they listened to has been deleted
 *
 * @param {Object} data object containing the document ID (or an array of IDs)
 * @param {Object} [connection] type
 * @return {Promise} number of notified rooms
 */
function notifyDocumentDelete (data, connection) {
  var
    deferred = q.defer(),
    notifiedRooms = 0,
    clonedData = _.clone(data),
    idList;

  if (data.action === 'deleteByQuery') {
    idList = data.ids;
    clonedData.action = 'delete';
    delete clonedData.ids;
  } else {
    idList = [data._id];
  }

  async.each(idList, function (id, callback) {
    this.services.list.notificationCache.search(id)
    .then(function (cachedRooms) {
      notifiedRooms += cachedRooms.length;
      clonedData._id = id;
      this.notifier.notify(cachedRooms, clonedData, connection);
      return this.services.list.notificationCache.remove(id);
    }.bind(this))
    .then(callback())
    .catch(function (error) {
        this.log.error(error);
        callback(error);
    }.bind(this));
  }.bind(this),
  function (error) {
    if (error) {
      deferred.reject(error);
    } else {
      deferred.resolve(notifiedRooms);
    }
  });

  return deferred.promise;
}
