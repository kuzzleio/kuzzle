var
  q = require('q'),
  WS = require('ws'),
  InternalError = require('kuzzle-common-objects').Errors.internalError;

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
    retryInterval: options.retryInterval || 1000
  };
  this.server = {
    host: options.host,
    port: options.port
  };
  
  this.handlers = {};
  this.onConnectHandlers = [];
  this.onCloseHandlers = [];
  this.onErrorHandlers = [];
  
  
  this.ws = () => new WS(`ws://${this.server.host}:${this.server.port}`, {perMessageDeflate: false});
  
  this.reconnect = true;
  this.retryTimer = null;
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
    
    this.onConnectHandlers.forEach(f => f());

    this.client.state = 'connected';
    
    if (!this.client.connected.promise.isFulfilled()) {
      return this.client.connected.resolve(this.client.socket);
    }
    
    this.pluginsManager.trigger('log:warn', `[${this.eventName}] Node is connected while it was previously already.`);
  });

  this.client.socket.on('close', code => {
    // Automatically reconnect except if this.close() was called
    if (this.client.state === 'disconnected') {
      return false;
    }
    this.close();
    
    this.onCloseHandlers.forEach(f => f());

    this.pluginsManager.trigger(this.eventName+':socketClosed',
      `Socket closed with code ${code}
      ==> RECONNECTING IN ${this.client.retryInterval}ms`
    );

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.reconnect) {
      this.retryTimer = setTimeout(() => this._connect(), this.client.retryInterval);
    }
  });

  this.client.socket.on('error', err => {
    this.close();
    
    this.onErrorHandlers.forEach(f => f());

    this.pluginsManager.trigger('log:error',
      `[${this.eventName}] Error while trying to connect to ws://${this.server.host}:${this.server.port} [${err.message}]
      ==> RECONNECTING IN ${this.client.retryInterval}ms`
    );
    this.pluginsManager.trigger(this.eventName+':error', {host: this.server.host, port: this.server.port, message: err.message, retry: this.client.retryInterval});

    this.client.state = 'retrying';
    
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.reconnect) {
      this.retryTimer = setTimeout(() => this._connect(), this.client.retryInterval);
    }
  });
  
};

/**
 * Sends `data` to the server.
 *
 * @param {string} room
 * @param {object} data
 */
WSBrokerClient.prototype.broadcast = function (room, data) {
  return emit.call(this, 'broadcast', room, data);
};


/**
 *
 * @param {string} room
 * @param {object} data
 */
WSBrokerClient.prototype.send = function (room, data) {
  return emit.call(this, 'send', room, data);
};

WSBrokerClient.prototype.waitForClients = function () {
  return q.reject(new InternalError('Not implemented for broker client'));
};

module.exports = WSBrokerClient;

function emit (mode, room, data) {
  if (!this.client.socket) {
    this.pluginsManager.trigger('log:error', `No socket for broker ${this.eventName}`);
    return false;
  }

  return this.client.socket.send(JSON.stringify({
    action: mode,
    room: room,
    data: data
  }));
  
}
