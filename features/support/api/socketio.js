const
  Bluebird = require('bluebird'),
  WsApiBase = require('./websocketBase'),
  io = require('socket.io-client');

class SocketIoApi extends WsApiBase {

  constructor (world) {
    super(world);

    this.subscribedRooms = {};
    this.responses = null;

    this.sockets = {};
  }

  get socket () {
    return this.sockets.client1;
  }

  _initSocket (name = 'client1') {
    if (this.sockets[name]) {
      return Bluebird.resolve();
    }

    this.sockets[name] = io(`http://${this.world.config.host}:${this.world.config.port}`, {
      'force new connection': true
    });

    return Bluebird.resolve();
  }

  _socketOnce (socket, roomId, cb) {
    return socket.once(roomId, cb);
  }

  _socketOn (socket, channel, listener) {
    return socket.on(channel, listener);
  }

  _socketRemoveListener (socket, channel, listener) {
    return socket.removeListener(channel, listener);
  }

  _socketSend (socket, msg) {
    return socket.emit('kuzzle', msg);
  }

  disconnect () {
    for (const socketKey of Object.keys(this.sockets)) {
      this.sockets[socketKey].destroy();
      delete this.sockets[socketKey];
    }
  }

}

module.exports = SocketIoApi;
