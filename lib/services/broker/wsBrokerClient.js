'use strict';

const
  debug = require('debug')('kuzzle:broker:client'),
  path = require('path'),
  Promise = require('bluebird'),
  InternalError = require('kuzzle-common-objects').errors.InternalError;

let WS = require('ws'); // cannot be constant: stubbed in unit tests

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

  this._pingTimeout = options.pingTimeout || 50;
  this._pingInterval = options.pingInterval || 1000 * 60;
  this._pingRequestTimeoutId = null;
  this._pingRequestIntervalId = null;

  this.client = {
    socket: null,
    connected: null,
    state: 'disconnected',
    retryInterval: options.retryInterval || 1000
  };

  this.handlers = {};
  this.onConnectHandlers = [];
  this.onCloseHandlers = [];
  this.onErrorHandlers = [];
  this.server = {};

  if (options.host) {
    this.server.address = `ws://${options.host}:${options.port}`;
    this.server.transport = 'tcp';
  }
  else if (options.socket) {
    this.server.address = `ws+unix://${path.resolve(options.socket)}`;
    this.server.transport = 'unix';
    this.server.path = options.socket;
  }
  else {
    throw new InternalError('No endpoint configuration given to connect.');
  }

  this.ws = () => new WS(this.server.address, {perMessageDeflate: false});

  this.reconnect = true;
  this.retryTimer = null;
}

/**
 * Initializes the underlying Web socket connection
 *
 * @type {WSBrokerClient.client}
 */
WSBrokerClient.prototype.init = function wSBrokerClientInit () {
  if (this.client.connected) {
    return this.client.connected.promise;
  }

  this.client.state = 'pending';
  this.client.connected = getDeferredPromise();
  this._connect();

  return this.client.connected.promise;
};

/**
 * Attaches a callback to a given room.
 *
 * @param {string} room
 * @param {function} cb The callback
 */
WSBrokerClient.prototype.listen = function wSBrokerClientListen (room, cb) {
  if (!this.client.socket) {
    this.pluginsManager.trigger('log:error', `No socket for broker ${this.eventName}`);
    return false;
  }

  debug('[%s] broker client subscribed to room "%s"', this.eventName, room);

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
WSBrokerClient.prototype.unsubscribe = function wSBrokerClientUnsubscribe (room) {
  if (!this.client.socket) {
    this.pluginsManager.trigger('log:error', `No socket for broker ${this.eventName}`);
    return false;
  }

  debug('[%s] broker client unsubscribed to room "%s"', this.eventName, room);

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
WSBrokerClient.prototype.close = function wSBrokerClientClose () {
  if (!this.client.socket) {
    this.pluginsManager.trigger('log:error', `No socket for broker ${this.eventName}`);
    return false;
  }

  resetPing(this);

  if (this.client.state === 'connected') {
    this.client.state = 'disconnected';
    this.client.socket.close();
    this.client.socket = null;
    this.client.connected = getDeferredPromise();
  }
};

/**
 * Initiates the connection to the server.
 * Resolves the promise once connected.
 * 
 * @private
 */
WSBrokerClient.prototype._connect = function wSBrokerClientConnect () {
  this.client.socket = this.ws();

  debug('[%s] initialize broker client connection on socket "%s"', this.eventName, this.server.address);

  this.client.socket.on('message', msg => {
    msg = JSON.parse(msg);

    debug('[%s] broker client received a message:\n%O', this.eventName, msg);

    if (msg.room && this.handlers[msg.room]) {
      this.handlers[msg.room].forEach(cb => cb(msg.data));
    }
  });

  this.client.socket.on('open', () => {
    debug('[%s] broker client connected', this.eventName);

    this.pluginsManager.trigger(this.eventName + ':connected', 'Connected to Kuzzle server');

    // if we were already listening to some rooms, subscribe again to the server
    Object.keys(this.handlers).forEach(room => {
      this.pluginsManager.trigger(this.eventName + ':reregistering', 'Re-registering room: ' + room);

      if (this.notifyOnListen !== false) {
        this.client.socket.send(JSON.stringify({
          action: 'listen',
          room: room
        }));
      }
    });

    this.onConnectHandlers.forEach(f => f());
    this.client.state = 'connected';

    resetPing(this);
    pingRequest(this);

    if (!this.client.connected.promise.isFulfilled()) {
      return this.client.connected.resolve(this.client.socket);
    }

    this.pluginsManager.trigger('log:warn', `[${this.eventName}] Node is connected while it was previously already.`);
  });

  this.client.socket.on('close', code => {
    debug('[%s] broker client received a exit code: %s', this.eventName, code);

    // Automatically reconnect except if this.close() was called
    if (this.client.state === 'disconnected') {
      return false;
    }
    this.close();

    this.onCloseHandlers.forEach(f => f());

    this.pluginsManager.trigger(this.eventName + ':socketClosed',
      `Socket closed with code ${code}
    ==> RECONNECTING IN ${this.client.retryInterval}ms`
    );

    this.client.state = 'retrying';

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    if (this.reconnect) {
      this.retryTimer = setTimeout(() => this._connect(), this.client.retryInterval);
    }
  });

  this.client.socket.on('error', err => {
    debug('[%s] broker client received an error: %s', this.eventName, err);

    this.close();

    this.onErrorHandlers.forEach(f => f());

    this.pluginsManager.trigger('log:error',
      `[${this.eventName}] Error while trying to connect to ${this.server.address} [${err.message}]
    ==> RECONNECTING IN ${this.client.retryInterval}ms`
    );
    this.pluginsManager.trigger(this.eventName + ':error', {
      server: this.server.address,
      message: err.message,
      retry: this.client.retryInterval
    });

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
WSBrokerClient.prototype.broadcast = function wSBrokerClientBroadcast (room, data) {
  return emit(this, 'broadcast', room, data);
};

/**
 *
 * @param {string} room
 * @param {object} data
 */
WSBrokerClient.prototype.send = function wSBrokerClientSend (room, data) {
  return emit(this, 'send', room, data);
};

WSBrokerClient.prototype.waitForClients = function wSBrokerClientWaitForClients () {
  return Promise.reject(new InternalError('Not implemented for broker client'));
};

module.exports = WSBrokerClient;

/**
 * @param {WSBrokerClient} broker
 * @param {string} mode
 * @param {string} room
 * @param {object} data
 * @returns {*}
 */
function emit (broker, mode, room, data) {
  if (!broker.client.socket) {
    broker.pluginsManager.trigger('log:error', `No socket for broker ${broker.eventName}`);
    return false;
  }

  debug('[%s] broker client %s a message in room "%s":\n%O', broker.eventName, mode, room, data);

  return broker.client.socket.send(JSON.stringify({
    action: mode,
    room: room,
    data: data
  }));
}

function getDeferredPromise() {
  var
    resolve,
    reject,
    promise;

  promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {resolve, reject, promise};
}

/**
 * Ensure that ping timeout, ping interval and pong listener are empty
 * @param {WSBrokerClient} broker
 */
function resetPing(broker) {
  debug('[%s] broker client reset ping requests status', broker.eventName);

  if (broker.client && broker.client.socket) {
    broker.client.socket.removeAllListeners('pong');
  }

  if (broker._pingRequestIntervalId) {
    clearTimeout(broker._pingRequestIntervalId);
    broker._pingRequestIntervalId = null;
  }

  if (broker._pingRequestTimeoutId) {
    clearTimeout(broker._pingRequestTimeoutId);
    broker._pingRequestTimeoutId = null;
  }
}

/**
 * Send a ping request to server
 * - register pong response handler
 * - handle the ping request timeout
 * @param {WSBrokerClient} broker
 */
function pingRequest(broker) {
  debug('[%s] broker client sending ping request to server', broker.eventName);

  broker.client.socket.once('pong', () => handlePongResponse(broker));
  broker.client.socket.ping();

  broker._pingRequestTimeoutId = setTimeout(() => {
    debug('[%s] ping timed out, disconnecting from server', broker.eventName);

    if (broker.client.socket) {
      broker.client.socket.emit('error', new Error('Connection to server timed out'));
    }

  }, broker._pingTimeout);
}

/**
 * Pong response handler
 * - remove ping timeout
 * - delay new ping request
 * @param {WSBrokerClient} broker
 */
function handlePongResponse(broker) {
  debug('[%s] broker client received pong from server', broker.eventName);

  if (broker._pingRequestTimeoutId) {
    clearTimeout(broker._pingRequestTimeoutId);
    broker._pingRequestTimeoutId = null;
  }

  broker._pingRequestIntervalId = setTimeout(() => {
    pingRequest(broker);
  }, broker._pingInterval);
}
