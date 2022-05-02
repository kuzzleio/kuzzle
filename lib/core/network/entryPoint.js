/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
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

const fs = require('fs');
const path = require('path');

const Bluebird = require('bluebird');

const { RequestContext } = require('../../api/request');
const Context = require('./context');
const debug = require('../../util/debug')('kuzzle:network:embedded');
const MqttProtocol = require('./protocols/mqttProtocol');
const InternalProtocol = require('./protocols/internalProtocol');
const HttpWsProtocol = require('./protocols/httpwsProtocol');
const Manifest = require('./protocolManifest');
const { removeStacktrace } = require('../../util/stackTrace');
const kerror = require('../../kerror');
const { AccessLogger } = require('./accessLogger');

const networkError = kerror.wrap('network', 'entrypoint');

const DEFAULT_PROTOCOLS = [
  HttpWsProtocol,
  MqttProtocol,
  InternalProtocol,
];

class EntryPoint {
  constructor () {
    this.config = global.kuzzle.config.server;

    this.protocols = new Map();

    this._clients = new Map();

    this.accessLogger = new AccessLogger();

    this.isShuttingDown = false;
  }

  dispatch (event, data) {
    switch (event) {
      case 'notify':
        this._notify(data);
        return;
      case 'broadcast':
        this._broadcast(data);
        return;
      case 'shutdown':
        this.isShuttingDown = true;
        return ;
      default:
        throw networkError.get('unexpected_event', event);
    }
  }

  /**
   * Initializes the InternalProtocol first to allow subscriptions
   * in plugins init() method.
   *
   * @returns {Promise}
   */
  async init () {
    for (const ProtocolClass of DEFAULT_PROTOCOLS) {
      const protocol = new ProtocolClass();

      this.protocols.set(protocol.name, protocol);
    }

    return this.protocols.get('internal').init(this);
  }

  /**
   * Starts the network protocols.
   * Every protocol is listening for request after this call
   *
   * @returns {Promise}
   */
  async startListening () {
    // We need to verify the port ourselves, to make sure Node.js won't open
    // a named pipe if the provided port number is a string
    if (! Number.isInteger(this.config.port)) {
      throw networkError.get('invalid_port', this.config.port);
    }

    await this.accessLogger.init();

    const initPromises = [];

    for (const protocol of this.protocols.values()) {
      // InternalProtocol is already initialized
      if (protocol.initCalled) {
        continue;
      }

      initPromises.push(protocol.init(this)
        .then(enabled => {
          if (! enabled) {
            this.protocols.delete(protocol.name);
          }
        })
      );
    }

    await Bluebird.all(initPromises);


    await this.loadMoreProtocols();
  }

  /**
   * On client subscribing to a channel, dispatch the information
   * to the protocol.
   *
   * @param {string} channel
   * @param {string} connectionId
   */
  joinChannel (channel, connectionId) {
    debug('[server] client "%s" joining channel "%s"', connectionId, channel);

    const client = this._clients.get(connectionId);

    if (! client || ! client.protocol) {
      return;
    }

    try {
      this.protocols.get(client.protocol).joinChannel(channel, connectionId);
    }
    catch (e) {
      global.kuzzle.log.error(`[join] protocol ${client && client.protocol} failed: ${e.message}`);
    }
  }

  leaveChannel (channel, connectionId) {
    debug(
      '[server] connection "%s" leaving channel "%s"',
      connectionId,
      channel);

    const client = this._clients.get(connectionId);

    if (! client || ! client.protocol) {
      return;
    }

    try {
      this.protocols.get(client.protocol).leaveChannel(channel, connectionId);
    }
    catch (e) {
      global.kuzzle.log.error(`[leave channel] protocol ${client && client.protocol} failed: ${e.message}`);
    }
  }

  /**
   * Loads installed protocols in memory
   */
  async loadMoreProtocols () {
    const dir = path.join(__dirname, '../../../protocols/enabled');
    let dirs;

    try {
      dirs = fs.readdirSync(dir);
    }
    catch (e) {
      // ignore if there is no protocols directory
      return;
    }

    dirs = dirs
      .map(d => path.join(dir, d))
      .filter(d => fs.statSync(d).isDirectory());

    await Bluebird.map(dirs, protoDir => {
      const protocol = new (require(protoDir))();
      const manifest = new Manifest(protoDir, protocol);

      manifest.load();

      const initTimeout = global.kuzzle.config.services.common.defaultInitTimeout;

      return Bluebird.resolve()
        .then(() => protocol.init(this, new Context()))
        .catch(error => {
          global.kuzzle.log.error(`Error during "${manifest.name}" protocol init:`);
          throw error;
        })
        .timeout(initTimeout, `Protocol "${manifest.name}" initialization timed out after ${initTimeout}ms. Try to increase the configuration "services.common.defaultInitTimeout".`)
        .then(() => {
          if (this.protocols.has(manifest.name)) {
            throw kerror.get('protocol', 'runtime', 'already_exists', manifest.name);
          }

          this.protocols.set(manifest.name, protocol);
        });
    });
  }

  /**
   * @param {ClientConnection} connection
   * @param {Request} request
   * @param {object} extra
   */
  logAccess (connection, request, extra = null) {
    this.accessLogger.log(connection, request, extra);
  }

  /*
  -----------------------------------------------------------------------
  methods exposed to protocols
  -----------------------------------------------------------------------
  */

  /**
   * @param {ClientConnection} connection
   * @param {Request} request
   * @param cb
   */
  execute (connection, request, cb) {
    if (this.isShuttingDown) {
      debug('Shutting down. Dropping request: %a', request);
      this._isShuttingDownError(connection, request, cb);
      return;
    }

    debug('Funneling request: %a', request);

    global.kuzzle.funnel.execute(request, (error, result) => {
      const _res = result || request;

      if (error && ! _res.error) {
        _res.setError(error);
      }

      this.logAccess(connection, _res);

      const response = _res.response.toJSON();

      cb(removeStacktrace(response));
    });
  }

  /**
   *
   * @param {ClientConnection} connection
   */
  newConnection (connection) {
    this._clients.set(connection.id, connection);

    global.kuzzle.emit('connection:new', connection);
    global.kuzzle.router.newConnection(new RequestContext({ connection }));
    debug(
      'New connection created: %s (protocol: %s)',
      connection.id,
      connection.protocol);
  }

  /**
   * @param {string} connectionId
   */
  removeConnection (connectionId) {
    const connection = this._clients.get(connectionId);

    if (connection) {
      global.kuzzle.emit('connection:remove', connection);

      global.kuzzle.router.removeConnection(new RequestContext({ connection }));

      this._clients.delete(connectionId);

      debug(
        'Removed connection: %s (protocol: %s)',
        connection.id,
        connection.protocol);
    }
  }

  // --------------------------------------------------------------------

  _broadcast (data) {
    const sanitized = removeStacktrace(data);

    debug('[server] broadcasting data through all protocols: %a', sanitized);

    for (const [name, protocol] of this.protocols.entries()) {
      try {
        protocol.broadcast(sanitized);
      }
      catch (e) {
        global.kuzzle.log.error(`[broadcast] protocol ${name} failed: ${e.message}\n${e.stack}`);
      }
    }
  }

  _isShuttingDownError (connection, request, cb) {
    request.setError(networkError.get('shutting_down'));
    this.logAccess(connection, request);

    cb(removeStacktrace(request.response.toJSON()));
  }

  _notify (data) {
    debug(
      '[server] sending notification to client with connection id "%s": %a',
      data.connectionId,
      data);

    const client = this._clients.get(data.connectionId);

    if (! client || ! client.protocol) {
      return;
    }

    try {
      this.protocols.get(client.protocol).notify(removeStacktrace(data));
    }
    catch (e) {
      global.kuzzle.log.error(`[notify] protocol ${client.protocol} failed: ${e.message}`);
    }
  }
}

module.exports = EntryPoint;
