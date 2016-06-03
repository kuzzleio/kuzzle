var
  q = require('q'),
  WS = require('ws');

/**
 * Websocket client implementation for Kuzzle internal broker
 *
 * @param kuzzle
 * @constructor
 */
function WSBrokerClient (options, pluginsManager) {
  this.pluginsManager = pluginsManager;

  this.client = {
    socket: null,
    connected: null,
    state: 'disconnected',
    retryInterval: 1000
  };
  this.server = {
    host: options.host,
    port: options.port
  };
  this.handlers = {};

  this.ws = () => new WS(`ws://${this.server.host}:${this.server.port}`, {perMessageDeflate: false});
}

/**
 * Initializes the underlying Web socket connection
 *
 * @type {WSBrokerClient.client}
 */
WSBrokerClient.prototype.init = function () {
  if (this.client.state === 'pending' || this.client.state === 'connected') {
    return this.client.connected.promise;
  }

  if (!this.client.connected) {
    this.client.connected = q.defer();
  }
  this.client.state = 'pending';

  this.client.socket = this.ws();

  this.client.socket.on('message', msg => {
    msg = JSON.parse(msg);

    if (msg.room && this.handlers[msg.room]) {
      this.handlers[msg.room].forEach(cb => cb(msg.data));
    }
  });

  this.client.socket.on('open', () => {
    this.pluginsManager.trigger('internalBroker:connected', 'Connected to Kuzzle server');

    // if we were already listening to some rooms, subscribe again to the server
    Object.keys(this.handlers).forEach(room => {
      this.pluginsManager.trigger('internalBroker:reregistering', 'Re-registering room: ' + room);

      this.client.socket.send(JSON.stringify({
        action: 'listen',
        room: room
      }));
    });

    this.client.state = 'connected';
    return this.client.connected.resolve(this.client.socket);
  });

  this.client.socket.on('close', code => {
    // Automatically reconnect except if this.close() was called
    if (this.client.state === 'disconnected') {
      return false;
    }

    this.close();

    this.pluginsManager.trigger('internalBroker:socketClosed',
      `Socket closed with code ${code}
      ==> RECONNECTING IN ${this.client.retryInterval}ms`
    );

    setTimeout(() => {
      this.init();
    }, this.client.retryInterval);
  });

  this.client.socket.on('error', err => {
    this.close();

    this.pluginsManager.trigger('log:error',
      `Error while trying to connect to ws://${this.server.host}:${this.server.port} [${err.message}]
      ==> RECONNECTING IN ${this.client.retryInterval}ms`
    );
    this.pluginsManager.trigger('internalBroker:error', {host: this.server.host, port: this.server.port, message: err.message, retry: this.client.retryInterval});

    this.client.state = 'retrying';

    setTimeout(() => {
      this.init();
    }, this.client.retryInterval);

  });

  return this.client.connected.promise;
};

/**
 * Attaches a callback to a given room.
 *
 * @param {string} room
 * @param {function} cb The callback
 */
WSBrokerClient.prototype.listen = function (room, cb) {
  if (this.handlers[room] === undefined) {
    this.handlers[room] = [];
  }
  this.handlers[room].push(cb);
  this.client.socket.send(JSON.stringify({
    action: 'listen',
    room: room
  }));
};

/**
 * Stops listening to `room` notifications.
 *
 * @param {string} room
 */
WSBrokerClient.prototype.unsubscribe = function (room) {
  if (this.handlers[room]) {
    delete this.handlers[room];
  }
  this.client.socket.send(JSON.stringify({
    action: 'unsubscribe',
    room: room
  }));
};

/**
 * Closes the underlying Websocket.
 */
WSBrokerClient.prototype.close = function () {
  if (this.client.socket) {
    if (this.client.state === 'connected') {
      this.client.state = 'disconnected';
      this.client.socket.close();
      this.client.socket = null;
      this.client.connected = null;
    }
  }
};

/**
 * Sends `data` to the server.
 *
 * @param {string} room
 * @param {object} data
 */
WSBrokerClient.prototype.broadcast = WSBrokerClient.prototype.send = function (room, data) {
  return this.client.socket.send(JSON.stringify({
    action: 'send',
    room: room,
    data: data
  }));
};

module.exports = WSBrokerClient;


