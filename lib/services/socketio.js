var
  Io = require('socket.io'),
  q = require('q');

module.exports = socketio = {
  kuzzle: null,
  io: null,

  /**
   * @param kuzzle
   */
  init: function (kuzzle) {
    socketio.kuzzle = kuzzle;
  },

  run: function (server) {
    this.io = new Io(server);
    this.io.set('origins', '*:*');
  },

  on: function (event, callback) {
    this.io.on(event, callback);
  },

  emit: function (event, data) {
    this.io.emit(event, data);
  },

  to: function (connectionId) {
    return this.io.to(connectionId);
  }
};