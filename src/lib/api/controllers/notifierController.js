var
  _ = require('lodash'),
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
   * On a document change, depending of the change type, get the list of concerned rooms,
   * and notify them, and update the Document<=>Room links cache.
   *
   * @param {Object} data object describing the document
   * @param {String} [connection] type
   */
  this.documentChanged = function (data, connection) {
    var
      idList,
      cachedRooms = [];

    if (data._id) {
      idList = [data._id];
    } else {
      idList = data.ids;
    }

    // Get the cached Document<=>Rooms links
    if (data.action !== 'create') {
      async.each(idList, function (id, callback) {
        kuzzle.services.list.cache.search(id)
          .then(function (rooms) {
            Array.prototype.push.apply(cachedRooms, rooms);
            callback();
          });
      });
    }

    // Notify rooms
    if (data.action === 'create' || data.action === 'update') {
      kuzzle.dsl.testFilters(data)
        .then(function (rooms) {
          var
            clonedData,
            stopListening;

          kuzzle.services.list.cache.add(data._id, rooms);
          this.notify(rooms, data, connection);

          if (data.action === 'update') {
            clonedData = _.clone(data);
            delete clonedData.body;
            stopListening = _.difference(cachedRooms, rooms);
            this.notify(stopListening, clonedData, connection);
            kuzzle.services.list.cache.remove(data._id, stopListening);
          }
        }.bind(this))
        .catch(function (error) {
          kuzzle.log.error(error);
        });
    } else if (data.action === 'delete' || data.action === 'deleteByQuery') {
      this.notify(cachedRooms, data, connection);
      async.each(idList, function (id, callback) {
        kuzzle.services.list.cache.remove(id)
          .then(callback());
      });
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