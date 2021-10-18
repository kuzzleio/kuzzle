'use strict';

const
  Bluebird = require('bluebird'),
  WsApiBase = require('./websocketBase'),
  Ws = require('ws');

class WebSocketApi extends WsApiBase {

  constructor (world) {
    super(world);

    this.responses = null;
    this.subscribedRooms = {};

    this.sockets = {};
    this.requests = {};
  }

  get socket () {
    return this.socket.client1;
  }

  _initSocket (name = 'client1') {
    if (this.sockets[name]) {
      return Bluebird.resolve();
    }

    return new Bluebird((resolve, reject) => {
      this.sockets[name] = new Ws(`ws://${this.world.config.host}:${this.world.config.port}`, {
        perMessageDeflate: false
      });

      this.sockets[name].on('message', message => {
        const data = JSON.parse(message);
        this.responses = data;

        if (data.scope || data.type === 'user' || data.type === 'TokenExpired') {
          // notification
          const channel = data.room;
          const roomId = channel.split('-')[0];

          if (this.subscribedRooms[name] && this.subscribedRooms[name][roomId]) {
            const room = this.subscribedRooms[name][roomId];
            if (room.channel === channel) {
              room.listener(data);
            }
            else {
              throw new Error('Channels do not match');
            }
          }
        }
        else if (this.requests[data.requestId]) {
          // response
          this.requests[data.requestId](data);
        }
      });
      this.sockets[name].on('error', reject);
      this.sockets[name].on('open', resolve);
    });
  }

  _socketOn () {
    // do nothing
  }

  /**
   *
   * @param {WebSocket} socket
   * @param {string} requestId
   * @param {Function} cb
   * @returns {*}
   * @private
   */
  _socketOnce (socket, requestId, cb) {
    this.requests[requestId] = cb;
  }

  _socketRemoveListener () {
    // do nothing
  }

  /**
   *
   * @param {WebSocket} socket
   * @param {object} msg
   * @returns {*}
   * @private
   */
  _socketSend (socket, msg) {
    return socket.send(JSON.stringify(msg), err => {
      if (err) {
        throw err;
      }
    });
  }

  disconnect () {
    for (const socketKey of Object.keys(this.sockets)) {
      this.sockets[socketKey].terminate();
      delete this.sockets[socketKey];
    }
  }

}

module.exports = WebSocketApi;
