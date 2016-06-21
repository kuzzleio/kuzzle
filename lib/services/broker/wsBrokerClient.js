var
  q = require('q'),
  WS = require('ws');

/**
 * Websocket client implementation for Kuzzle internal broker
 *
 * @param brokerType
 * @param options
 * @param pluginsManager
 * @param notifyOnListen
 * @constructor
 */
function WSBrokerClient (brokerType, options, pluginsManager, notifyOnListen) {
  this.pluginsManager = pluginsManager;
  this.eventName = brokerType;
  this.notifyOnListen = notifyOnListen;

  this.client = {
    socket: null,
    connected: null,
    state: 'disconnected',
    retryInterval: options.retryInterval
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
  if (this.client.connected) {
    return this.client.connected.promise;
  }
  this.client.connected = q.defer();
  this.client.state = 'pending';

  this._connect();

  return this.client.connected.promise;
};

/**
 * Attaches a callback to a given room.
 *
 * @param {string} room
 * @param {function} cb The callback
 */
WSBrokerClient.prototype.listen = function (room, cb) {
  if (!this.client.socket) {
    this.pluginsManager.trigger('log:error', `No socket for broker ${this.eventName}`);
    return false;
  }

  if (this.handlers[room] === undefined) {
    this.handlers[room] = [];
  }
  this.handlers[room].push(cb);

  if (this.notifyOnListen !== false) {
    this.client.socket.send(JSON.stringify({
      action: 'listen',
      room: room
    }));
  }
};

/**
 * Stops listening to `room` notifications.
 *
 * @param {string} room
 */
WSBrokerClient.prototype.unsubscribe = function (room) {
  if (!this.client.socket) {
    this.pluginsManager.trigger('log:error', `No socket for broker ${this.eventName}`);
    return false;
  }

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
  if (!this.client.socket) {
    this.pluginsManager.trigger('log:error', `No socket for broker ${this.eventName}`);
    return false;
  }
  
  if (this.client.state === 'connected') {
    this.client.state = 'disconnected';
    this.client.socket.close();
    this.client.socket = null;
    this.client.connected = null;
  }
};

/**
 * Initiates the connection to the server.
 * Resolves the promise once connected.
 * 
 * @private
 */
WSBrokerClient.prototype._connect = function () {
  this.client.socket = this.ws();

  this.client.socket.on('message', msg => {
    msg = JSON.parse(msg);

    if (msg.room && this.handlers[msg.room]) {
      this.handlers[msg.room].forEach(cb => cb(msg.data));
    }
  });

  this.client.socket.on('open', () => {
    this.pluginsManager.trigger(this.eventName+':connected', 'Connected to Kuzzle server');

    // if we were already listening to some rooms, subscribe again to the server
    Object.keys(this.handlers).forEach(room => {
      this.pluginsManager.trigger(this.eventName+':reregistering', 'Re-registering room: ' + room);

      if (this.notifyOnListen !== false) {
        this.client.socket.send(JSON.stringify({
          action: 'listen',
          room: room
        }));
      }
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

    this.pluginsManager.trigger(this.eventName+':socketClosed',
      `Socket closed with code ${code}
      ==> RECONNECTING IN ${this.client.retryInterval}ms`
    );

    setTimeout(this._connect.bind(this), this.client.retryInterval);
  });

  this.client.socket.on('error', err => {
    this.close();

    this.pluginsManager.trigger('log:error',
      `[${this.eventName}] Error while trying to connect to ws://${this.server.host}:${this.server.port} [${err.message}]
      ==> RECONNECTING IN ${this.client.retryInterval}ms`
    );
    this.pluginsManager.trigger(this.eventName+':error', {host: this.server.host, port: this.server.port, message: err.message, retry: this.client.retryInterval});

    this.client.state = 'retrying';
    
    setTimeout(this._connect.bind(this), this.client.retryInterval);
  });
  
};

/**
 * Sends `data` to the server.
 *
 * @param {string} room
 * @param {object} data
 */
WSBrokerClient.prototype.broadcast = WSBrokerClient.prototype.send = function (room, data) {
  if (!this.client.socket) {
    this.pluginsManager.trigger('log:error', `No socket for broker ${this.eventName}`);
    return false;
  }

  return this.client.socket.send(JSON.stringify({
    action: 'send',
    room: room,
    data: data
  }));
};

module.exports = WSBrokerClient;


