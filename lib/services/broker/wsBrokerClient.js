/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const
  debug = require('../../kuzzleDebug')('kuzzle:broker:client'),
  path = require('path'),
  Bluebird = require('bluebird'),
  KuzzleInternalError = require('kuzzle-common-objects').errors.InternalError,
  WS = require('uws');

/**
 * Websocket client implementation for Kuzzle internal broker
 */
class WSBrokerClient {
  /**
   * @param {string} brokerType
   * @param {object} options
   * @param {PluginsManager} pluginsManager
   * @param {boolean} [notifyOnListen]
   */
  constructor(brokerType, options, pluginsManager, notifyOnListen) {
    this.pluginsManager = pluginsManager;
    this.eventName = brokerType;
    this.notifyOnListen = notifyOnListen;

    this._pingTimeout = options.pingTimeout || 500;
    this._pingInterval = options.pingInterval || 1000 * 60;
    this._pingRequestTimeoutId = null;
    this._pingRequestIntervalId = null;

    this.client = {
      socket: null,
      connected: getDeferredPromise(),
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
      throw new KuzzleInternalError('No endpoint configuration given to connect.');
    }

    this.ws = () => new WS(this.server.address, {perMessageDeflate: false});

    this.retryTimer = null;
  }

  /**
   * Initializes the underlying Web socket connection
   *
   * @type {WSBrokerClient.client}
   */
  init() {
    if (this.client.connected.promise.isFulfilled()) {
      return this.client.connected.promise;
    }

    return this._connect();
  }

  /**
   * Attaches a callback to a given room.
   *
   * @param {string} room
   * @param {function} cb The callback
   */
  listen(room, cb) {
    debug('[%s] broker client subscribed to room "%s"', this.eventName, room);

    if (this.handlers[room] === undefined) {
      this.handlers[room] = [];
    }

    this.handlers[room].push(cb);

    if (this.notifyOnListen !== false) {
      if (!this.client.socket || this.client.socket.readyState !== WS.OPEN) {
        debug('[%s] can not notify broker server of listening to room "%s": socket not available yet', this.eventName, room);
        return;
      }

      debug('[%s] notify broker server of listening to room "%s"', this.eventName, room);
      this.client.socket.send(JSON.stringify({
        action: 'listen',
        room
      }));
    }
  }

  /**
   * Stops listening to `room` notifications.
   *
   * @param {string} room
   */
  unsubscribe(room) {
    debug('[%s] broker client unsubscribed to room "%s"', this.eventName, room);

    if (this.handlers[room]) {
      delete this.handlers[room];
    }

    if (this.notifyOnListen !== false) {
      if (!this.client.socket || this.client.socket.readyState !== WS.OPEN) {
        debug('[%s] can not notify broker server of unsubscribing to room %s: socket not available yet', this.eventName, room);
        return false;
      }

      debug('[%s] notify broker server of unsubscribing to room "%s"', this.eventName, room);
      this.client.socket.send(JSON.stringify({
        action: 'unsubscribe',
        room
      }));
    }
  }

  /**
   * Closes the underlying Websocket.
   */
  close() {
    debug('[%s] broker client explicitly close connection', this.eventName);

    resetPing(this);

    if (this.client.connected.promise.isFulfilled()) {
      this.client.connected = getDeferredPromise();
    }

    if (!this.client.socket) {
      this.pluginsManager.trigger('log:error', `[${this.eventName}] Unable to close socket: socket not available`);
      return false;
    }

    if (this.client.socket.readyState === WS.OPEN || this.client.socket.readyState === WS.CONNECTING) {
      this.client.socket.close();
    }

    this.client.socket = null;
  }

  /**
   * Initiates the connection to the server.
   * Resolves the promise once connected.
   *
   * @private
   */
  _connect() {
    debug('[%s] initialize broker client connection on socket "%s"', this.eventName, this.server.address);

    this.client.socket = this.ws();

    this.client.socket.on('message', raw => {
      const msg = JSON.parse(raw);

      if (msg.room && this.handlers[msg.room]) {
        debug('[%s] broker client received a message in room "%s": %a', this.eventName, msg.room, msg.data);

        this.handlers[msg.room].forEach(cb => cb(msg.data));
      }
      else {
        debug('[%s] broker client received a message with unknown room: %a', this.eventName, msg);
      }
    });

    this.client.socket.on('open', () => {
      debug('[%s] broker client connected', this.eventName);

      resetPing(this);

      this.pluginsManager.trigger(this.eventName + ':connected', this.server.address);

      this.onConnectHandlers.forEach(f => f());

      // if we were already listening to some rooms, subscribe again to the server
      Object.keys(this.handlers).forEach(room => {
        debug('[%s] notify broker server of re-listening to room "%s"', this.eventName, room);

        this.pluginsManager.trigger(this.eventName + ':reregistering', room);

        if (this.notifyOnListen !== false) {
          this.client.socket.send(JSON.stringify({room, action: 'listen'}));
        }
      });

      pingRequest(this);

      if (!this.client.connected.promise.isFulfilled()) {
        return this.client.connected.resolve(this.client.socket);
      }

      this.pluginsManager.trigger('log:warn', `[${this.eventName}] Node is connected while it was previously already.`);
    });

    this.client.socket.on('close', code => {
      debug('[%s] broker client received a exit code: %s', this.eventName, code);

      // Automatically reconnect except if this.close() was called
      if (!this.client.socket) {
        return false;
      }

      this.pluginsManager.trigger(this.eventName + ':socketClosed', code);
      this.pluginsManager.trigger('log:warn', `[${this.eventName}] Socket closed with code ${code}`);

      this.onCloseHandlers.forEach(f => f(code));

      this.retryConnection();
    });

    this.client.socket.on('error', err => {
      debug('[%s] broker client received an error: %a', this.eventName, err);

      // Do not reconnect if this.close() was called (even if this.close() throw an error)
      if (!this.client.socket) {
        return false;
      }

      this.pluginsManager.trigger('log:warn', `[${this.eventName}] Error while trying to connect to ${this.server.address} [${err.message}]`);
      this.pluginsManager.trigger(this.eventName + ':error', {
        server: this.server.address,
        message: err.message,
        retry: this.client.retryInterval
      });

      this.onErrorHandlers.forEach(f => f(err));

      this.retryConnection();
    });

    return this.client.connected.promise;
  }

  /**
   * Delay new connection to broker server
   */
  retryConnection() {
    debug('[%s] broker client will retry to connect to broker server in %s ms', this.eventName, this.client.retryInterval);

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    // ensure that no socket is leaked
    if (this.client.socket) {
      this.close();
    }

    this.retryTimer = setTimeout(() => {
      debug('[%s] broker client retrying to connect to broker server', this.eventName);

      this._connect();
    }, this.client.retryInterval);

    this.pluginsManager.trigger('log:info', `[${this.eventName}] Reconnecting socket in ${this.client.retryInterval}ms`);
  }

  /**
   * Sends `data` to the server.
   *
   * @param {string} room
   * @param {object} data
   */
  broadcast(room, data) {
    debug('[%s] broker client broadcasting data to room "%s": %a', this.eventName, room, data);

    return emit(this, 'broadcast', room, data);
  }

  /**
   *
   * @param {string} room
   * @param {object} data
   */
  send(room, data) {
    debug('[%s] broker client sending data to room "%s": %a', this.eventName, room, data);

    return emit(this, 'send', room, data);
  }

  waitForClients() {
    return Bluebird.reject(new KuzzleInternalError('Not implemented for broker client'));
  }
}

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

  debug('[%s] broker client %s a message in room "%s": %a', broker.eventName, mode, room, data);

  return broker.client.socket.send(JSON.stringify({room, data, action: mode}));
}

function getDeferredPromise() {
  let
    resolve = null,
    reject = null;

  const promise = new Bluebird((res, rej) => {
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

  if (broker.client.socket) {
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
    if (!broker.client.socket || broker.client.socket.readyState === WS.OPEN) {
      debug('[%s] ping timed out, try to reconnect', broker.eventName);

      broker.retryConnection();
    }
    else {
      debug('[%s] ping timed out, socket not ready, delay new ping', broker.eventName);

      resetPing(broker);

      broker._pingRequestIntervalId = setTimeout(() => {
        pingRequest(broker);
      }, broker._pingInterval);
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
