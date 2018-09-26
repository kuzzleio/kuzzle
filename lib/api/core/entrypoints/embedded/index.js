/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
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
  Bluebird = require('bluebird'),
  Context = require('./context'),
  debug = require('../../../../kuzzleDebug')('kuzzle:entry-point:embedded'),
  EntryPoint = require('../entrypoint'),
  fs = require('fs'),
  http = require('http'),
  HttpProtocol = require('./protocols/http'),
  {
    models: {
      RequestContext
    },
    errors: {
      InternalError: KuzzleInternalError,
      ServiceUnavailableError
    }
  } = require('kuzzle-common-objects'),
  WebSocketProtocol = require('./protocols/websocket'),
  SocketIoProtocol = require('./protocols/socketio'),
  moment = require('moment'),
  path = require('path'),
  winston = require('winston'),
  WinstonElasticsearch = require('winston-elasticsearch'),
  WinstonSyslog = require('winston-syslog'),
  Manifest = require('./manifest');

const bearerRegexp = /^Bearer /i;

class EmbeddedEntryPoint extends EntryPoint {
  constructor (kuzzle) {
    super(kuzzle);

    this.config = kuzzle.config.server;

    this.httpServer = null;

    this.protocols = {};

    this.clients = {};

    this.logger = null;

    this.isShuttingDown = false;
  }

  dispatch (event, data) {
    if (event === 'notify') {
      return this._notify(data);
    }
    else if (event === 'broadcast') {
      return this._broadcast(data);
    }
    else if (event === 'shutdown') {
      this.isShuttingDown = true;
      return;
    }

    throw new KuzzleInternalError(`Unknown event received: ${event}`);
  }

  init () {
    // We need to verify the port ourselves, to make sure Node.js won't open
    // a named pipe if the provided port number is a string
    if (!Number.isInteger(this.config.port)) {
      throw new KuzzleInternalError(`Invalid network port number: ${this.config.port}`);
    }

    this.initLogger();

    this.httpServer = http.createServer();
    this.httpServer.listen(this.config.port, this.config.host);

    if (this.config.protocols.http.enabled) {
      this.protocols.http = new HttpProtocol();
      this.protocols.http.init(this);
    }

    if (this.config.protocols.websocket.enabled) {
      this.protocols.websocket = new WebSocketProtocol();
      this.protocols.websocket.init(this);
    }

    if (this.config.protocols.socketio.enabled) {
      this.protocols.socketio = new SocketIoProtocol();
      this.protocols.socketio.init(this);
    }

    return Bluebird.resolve()
      .then(() => this.loadMoreProtocols())
      .catch(e => {
        this.kuzzle.pluginsManager.trigger('log:error', e);
        throw e;
      });
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

    const client = this.clients[connectionId];

    if (!client || !client.protocol) {
      return;
    }

    try {
      this.protocols[client.protocol].joinChannel(channel, connectionId);
    }
    catch (e) {
      this.kuzzle.pluginsManager.trigger('log:error', `[join] protocol ${client && client.protocol} failed: ${e.message}`);
    }
  }

  leaveChannel (channel, connectionId) {
    debug('[server] connection "%s" leaving channel "%s"', connectionId, channel);

    const client = this.clients[connectionId];

    if (!client || !client.protocol) {
      return;
    }

    try {
      this.protocols[client.protocol].leaveChannel(channel, connectionId);
    }
    catch (e) {
      this.kuzzle.pluginsManager.trigger('log:error', `[leave channel] protocol ${client && client.protocol} failed: ${e.message}`);
    }
  }

  /**
   * Loads installed plugins in memory
   */
  loadMoreProtocols () {
    const dir = path.join(__dirname, '../../../../../protocols/enabled');

    let dirs;
    try {
      dirs = fs.readdirSync(dir);
    } catch(e) {
      return Bluebird.resolve();
    }

    dirs = dirs.map(d => path.join(dir, d))
      .filter(d => fs.statSync(d).isDirectory());

    return Bluebird.map(dirs, protoDir => {
      const
        protocol = new (require(protoDir))(),
        manifest = new Manifest(this.kuzzle, protoDir, protocol);

      manifest.load();

      return Bluebird.resolve()
        .then(() => protocol.init(this, new Context(this.kuzzle)))
        .catch(error => {
          this.kuzzle.pluginsManager.trigger('log:error', `Error during "${manifest.name}" protocol init:`);
          throw error;
        })
        .timeout(this.kuzzle.config.services.common.defaultInitTimeout)
        .then(() => {
          this.protocols[manifest.name] = protocol;
        });
    });
  }

  initLogger () {
    const transports = [];

    for (const conf of this.config.logs.transports) {
      const opts = {
        level: conf.level || 'info',
        silent: conf.silent || false,
        colorize: conf.colorize === true ? winston.format.colorize() : false,
        timestamp: conf.timestamp === true ? winston.format.timestamp() : false,
        prettyPrint: conf.prettyPrint === true ? winston.format.prettyPrint() : false,
        depth: conf.depth || false,
        format: conf.format ? winston.format[conf.format]() : winston.format.json()
      };

      switch (conf.transport || 'console') {
        case 'console':
          transports.push(new winston.transports.Console(Object.assign(opts, {
            humanReadableUnhandledException: conf.humanReadableUnhandledException || true,
            stderrLevels: conf.stderrLevels || ['error', 'debug']
          })));
          break;
        case 'elasticsearch':
          transports.push(new WinstonElasticsearch(Object.assign(opts, {
            index: conf.index,
            indexPrefix: conf.indexPrefix || 'kuzzle-access',
            indexSuffixPattern: conf.indexSuffixPattern || 'YYYY.MM',
            messageType: conf.messageType || 'access',
            ensureMappingTemplate: conf.ensureMappingTemplate !== false,
            mappingTemplate: conf.mappingTemplate || 'access.log.mapping.json',
            flushInterval: conf.flushInterval || 2000,
            clientOpts: conf.clientOpts || {}
          })));
          break;
        case 'file':
          transports.push(new winston.transports.File(Object.assign(opts, {
            filename: conf.filename || 'kuzzle.access.log',
            maxSize: conf.maxSize,
            maxFiles: conf.maxFiles,
            eol: conf.eol || '\n',
            logstash: conf.logstash || false,
            tailable: conf.tailable,
            maxRetries: conf.maxRetries || 2,
            zippedArchive: conf.zippedArchive || false
          })));
          break;
        case 'syslog':
          transports.push(new WinstonSyslog(Object.assign(opts, {
            host: conf.host || 'localhost',
            port: conf.port || 514,
            protocol: conf.protocol || 'udp4',
            path: conf.path || '/dev/log',
            pid: conf.pid || process.pid,
            facility: conf.facility || 'local0',
            localhost: conf.localhost || 'localhost',
            type: conf.type || 'BSD',
            app_name: conf.app_name || process.title,
            eol: conf.eol
          })));
          break;
        default:
          // eslint-disable-next-line no-console
          console.error(`Failed to initialize logger transport "${conf.transport}": unsupported transport. Skipped.`);
      }
    }

    this.logger = winston.createLogger({transports});
  }

  /**
   * /!\ This method is a critical section of code.
   * Modifications must be compared against current
   * performances benchmarks
   *
   * @param {Request} request
   * @param {object} extra
   */
  logAccess (request, extra = null) {
    const connection = this.clients[request.context.connection.id];

    if (!connection) {
      this.kuzzle.pluginsManager.trigger('log:warn', `[access log] No connection retrieved for connection id: ${request.context.connection.id} on ${request.input.controller}:${request.input.action}\n` +
        'Most likely, the connection was closed before the response was received.');
      return;
    }

    if (this.config.logs.accessLogFormat === 'logstash') {
      // custom kuzzle logs to be exported to logstash
      this.logger.info({
        connection,
        extra,
        request: request.input,
        error: request.error,
        status: request.status
      });
      return;
    }

    const protocol = connection.protocol.toUpperCase();

    // = apache combined
    let
      url,
      verb = 'DO',
      user = '-';

    if (connection && connection.protocol.startsWith('HTTP/')) {
      verb = extra.method;
      url = extra.url;

      // try to get plain user name, 1st form jwt token if present, then from basic auth
      if (connection.headers.authorization) {
        try {
          if (bearerRegexp.test(connection.headers.authorization)) {
            const
              b64Payload = connection.headers.authorization.split('.')[1],
              payload = Buffer.from(b64Payload, 'base64').toString('utf8');

            user = JSON.parse(payload)._id;
          }
          else {
            user = Buffer.from(connection.headers.authorization, 'base64')
              .toString('utf8')
              .split(':')[0];
          }
        }
        catch (err) {
          this.kuzzle.pluginsManager.trigger('log:warn', `Unable to extract user from authorization header: ${connection.headers.authorization}`);
        }
      }
    }
    else {
      // for other protocols than http, we reconstruct a pseudo url
      url = `/${request.input.controller}/${request.input.action}`;
      if (request.input.resource.index) {
        url += '/' + request.input.resource.index;
      }
      if (request.input.resource.collection) {
        url += '/' + request.input.resource.collection;
      }
      if (request.input.resource._id) {
        url += '/' + request.input.resource._id;
      }

      let queryString = '';

      for (const k of Object.keys(request.input.args)) {
        const val = request.input.args[k];

        if (queryString.length > 0) {
          queryString += '&';
        }

        queryString += `${k}=${typeof val === 'object' ? JSON.stringify(val) : val}`;
      }

      if (queryString.length > 0) {
        url += '?' + queryString;
      }

      if (request.input.jwt) {
        try {
          const
            b64Payload = request.input.jwt.split('.')[1],
            payload = Buffer.from(b64Payload, 'base64').toString('utf8');
          user = JSON.parse(payload)._id;
        }
        catch (err) {
          this.kuzzle.pluginsManager.trigger('log:warn', `Unable to extract user from jwt token: ${request.input.jwt}`);
        }
      }
    }

    this.logger.info(connection.ips[connection.ips.length - 1 - this.config.logs.accessLogIpOffset] +
      ' - ' +
      user +
      ' [' + moment().format('DD/MMM/YYYY:HH:mm:ss ZZ') + '] ' +
      `"${verb} ${url} ${protocol}" ` +
      (request.status || ' -') + ' ' +
      (request.response ? Buffer.byteLength(JSON.stringify(request.response)) : '-') + ' ' +
      (connection.headers.referer ? `"${connection.headers.referer}"` : '-') + ' ' +
      (connection.headers['user-agent'] ? `"${connection.headers['user-agent']}"` : '-'));
  }

  /*
  -----------------------------------------------------------------------
  methods exposed to protocols
  -----------------------------------------------------------------------
  */

  /**
   *
   * @param {Request} request
   * @param cb
   */
  execute (request, cb) {
    if (this.isShuttingDown) {
      return this._isShuttingDownError(request, cb);
    }

    this.kuzzle.funnel.execute(request, (error, result) => {
      if (error && !result.error) {
        result.setError(error);
      }

      this.logAccess(result);

      const response = result.response.toJSON();

      cb(this.constructor._removeErrorStack(response));
    });
  }

  /**
   *
   * @param {ClientConnection} connection
   */
  newConnection (connection) {
    this.clients[connection.id] = connection;
    this.kuzzle.router.newConnection(new RequestContext({connection}));
  }

  /**
   * @param {string} connectionId
   */
  removeConnection (connectionId) {
    const connection = this.clients[connectionId];

    if (connection) {
      this.kuzzle.router.removeConnection(new RequestContext({connection}));
      delete this.clients[connectionId];
    }
  }

  // --------------------------------------------------------------------

  _broadcast (data) {
    debug('[server] broadcasting data through all protocols: %a', data);

    for (const protoKey of Object.keys(this.protocols)) {
      const protocol = this.protocols[protoKey];

      try {
        protocol.broadcast(this.constructor._removeErrorStack(data));
      }
      catch (e) {
        this.kuzzle.pluginsManager.trigger('log:error', `[broadcast] protocol ${protoKey} failed: ${e.message}`);
      }
    }
  }

  _isShuttingDownError (request, cb) {
    request.setError(new ServiceUnavailableError('Kuzzle is shutting down'));
    this.logAccess(request);

    cb(this.constructor._removeErrorStack(request.response.toJSON()));
  }

  _notify (data) {
    debug('[server] sending notification to client with connection id "%s": %a', data.connectionId, data);

    const client = this.clients[data.connectionId];

    if (!client || !client.protocol) {
      return;
    }

    try {
      this.protocols[client.protocol].notify(this.constructor._removeErrorStack(data));
    }
    catch (e) {
      this.kuzzle.pluginsManager.trigger('log:error', `[notify] protocol ${client.protocol} failed: ${e.message}`);
    }
  }

  static _removeErrorStack (data) {
    if (process.env.NODE_ENV !== 'development'
      && data
      && data.content
      && data.content.error) {
      delete data.content.error.stack;
    }

    return data;
  }
}

module.exports = EmbeddedEntryPoint;
