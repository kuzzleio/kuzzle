var
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
      send.call(this, roomName, data, connection);
    }.bind(this));
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
        kuzzle.io.to(connection.id).emit(room, data);
        break;
      case 'amq':
        broker.replyTo(connection.id, data);
        break;
      case 'mqtt':
        broker.addExchange(connection.id, data);
        break;
    }
  }
  else {
    this.kuzzle.io.emit(room, data);
    this.kuzzle.services.list.broker.addExchange(room, data);
  }
}