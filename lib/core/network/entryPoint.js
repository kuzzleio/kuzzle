/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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
const moment = require('moment');
const winston = require('winston');
const WinstonElasticsearch = require('winston-elasticsearch');
const WinstonSyslog = require('winston-syslog');

const { RequestContext } = require('../../api/request');
const Context = require('./context');
const debug = require('../../util/debug')('kuzzle:network:embedded');
const MqttProtocol = require('./protocols/mqtt');
const InternalProtocol = require('./protocols/internal');
const HttpWsProtocol = require('./protocols/http+websocket');
const Manifest = require('./protocolManifest');
const ClientConnection = require('./clientConnection');
const removeErrorStack = require('./removeErrorStack');
const kerror = require('../../kerror');

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

    this.logger = null;

    this.isShuttingDown = false;

    this.anonymousUserId = null;
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
    if (!Number.isInteger(this.config.port)) {
      throw networkError.get('invalid_port', this.config.port);
    }

    this.initLogger();

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

    const anonymous = await global.kuzzle.ask('core:security:user:anonymous:get');
    this.anonymousUserId = anonymous._id;

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

    if (!client || !client.protocol) {
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

    if (!client || !client.protocol) {
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

  initLogger () {
    const transports = [];

    for (const conf of this.config.logs.transports) {
      const opts = {
        colorize: conf.colorize === true
          ? winston.format.colorize()
          : false,
        depth: conf.depth || false,
        format: conf.format
          ? winston.format[conf.format]()
          : winston.format.json(),
        level: conf.level || 'info',
        prettyPrint: conf.prettyPrint === true
          ? winston.format.prettyPrint()
          : false,
        silent: conf.silent || false,
        timestamp: conf.timestamp === true
          ? winston.format.timestamp()
          : false
      };

      switch (conf.transport || 'console') {
        case 'console':
          transports.push(
            new winston.transports.Console(
              Object.assign(
                opts,
                {
                  humanReadableUnhandledException: conf.humanReadableUnhandledException || true,
                  stderrLevels: conf.stderrLevels || ['error', 'debug']
                })));
          break;
        case 'elasticsearch':
          transports.push(
            new WinstonElasticsearch(
              Object.assign(
                opts,
                {
                  clientOpts: conf.clientOpts || {},
                  ensureMappingTemplate: conf.ensureMappingTemplate !== false,
                  flushInterval: conf.flushInterval || 2000,
                  index: conf.index,
                  indexPrefix: conf.indexPrefix || 'kuzzle-access',
                  indexSuffixPattern: conf.indexSuffixPattern || 'YYYY.MM',
                  mappingTemplate: conf.mappingTemplate || 'access.log.mapping.json',
                  messageType: conf.messageType || 'access'
                })));
          break;
        case 'file':
          transports.push(
            new winston.transports.File(
              Object.assign(
                opts,
                {
                  eol: conf.eol || '\n',
                  filename: conf.filename || 'kuzzle.access.log',
                  logstash: conf.logstash || false,
                  maxFiles: conf.maxFiles,
                  maxRetries: conf.maxRetries || 2,
                  maxSize: conf.maxSize,
                  tailable: conf.tailable,
                  zippedArchive: conf.zippedArchive || false
                })));
          break;
        case 'syslog':
          transports.push(
            new WinstonSyslog(
              Object.assign(
                opts,
                {
                  app_name: conf.app_name || process.title,
                  eol: conf.eol,
                  facility: conf.facility || 'local0',
                  host: conf.host || 'localhost',
                  localhost: conf.localhost || 'localhost',
                  path: conf.path || '/dev/log',
                  pid: conf.pid || process.pid,
                  port: conf.port || 514,
                  protocol: conf.protocol || 'udp4',
                  type: conf.type || 'BSD'
                })));
          break;
        default:
          global.kuzzle.log.error(`Failed to initialize logger transport "${conf.transport}": unsupported transport. Skipped.`);
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
    let connection = this._clients.get(request.context.connection.id);

    // Make do with the RequestContext information
    if (!connection) {
      connection = new ClientConnection(
        request.context.connection.protocol || '-',
        request.context.connection.ips || [],
        request.context.connection.misc.headers);
    }

    if (this.config.logs.accessLogFormat === 'logstash') {
      // custom kuzzle logs to be exported to logstash
      this.logger.info({
        connection,
        error: request.error,
        extra,
        request: request.input,
        status: request.status
      });
      return;
    }

    // user init: prioritize the already decoded and verified token stored in
    // the request
    // If not available, then that may mean that we didn't verify the user yet,
    // so we have to decode any provided token
    let user = null;

    if (request.context.token !== null) {
      user = request.context.token.userId === this.anonymousUserId
        ? '(anonymous)'
        : request.context.token.userId;
    }

    // = apache combined
    const protocol = connection.protocol.toUpperCase();
    let
      url,
      verb = 'DO';

    if (connection.protocol.indexOf('HTTP/') === 0) {
      verb = extra.method;
      url = extra.url;

      // try to get plain user name, 1st form jwt token if present, then from
      // basic auth
      const authHdr = connection.headers.authorization;
      if (user === null && authHdr) {
        try {
          if (authHdr.toLowerCase().indexOf('bearer') === 0) {
            const
              b64Payload = authHdr.split('.')[1],
              payload = Buffer.from(b64Payload, 'base64').toString('utf8');

            user = JSON.parse(payload)._id;
          }
          else {
            user = Buffer
              .from(authHdr, 'base64')
              .toString('utf8')
              .split(':')[0];
          }
        }
        catch (err) {
          // do nothing: we don't know anything about the token, it may be
          // invalid on-purpose for all we know
        }
      }
    }
    // for other protocols than http, we rebuild a pseudo url
    else {
      url = `/${request.input.controller}/${request.input.action}`;

      if (request.input.args.index) {
        url += `/${request.input.args.index}`;
      }

      if (request.input.args.collection) {
        url += `/${request.input.args.collection}`;
      }

      if (request.input.args._id) {
        url += `/${request.input.args._id}`;
      }

      let queryString = '';

      for (const k of Object.keys(request.input.args)) {
        if (k === '_id' || k === 'index' || k === 'collection') {
          continue;
        }

        const val = request.input.args[k];

        if (queryString.length > 0) {
          queryString += '&';
        }

        queryString += `${k}=${typeof val === 'object' ? JSON.stringify(val) : val}`;
      }

      if (queryString.length > 0) {
        url += `?${queryString}`;
      }

      if (user === null && request.input.jwt) {
        try {
          const
            b64Payload = request.input.jwt.split('.')[1],
            payload = Buffer.from(b64Payload, 'base64').toString('utf8');

          user = JSON.parse(payload)._id;
        }
        catch (err) {
          // do nothing: we don't know anything about the token, it may be
          // invalid on-purpose for all we know
        }
      }
    }

    if (user === null) {
      user = '-';
    }

    const
      ip = connection.ips[connection.ips.length - 1 - this.config.logs.accessLogIpOffset]
        || '-',
      ts = moment().format('DD/MMM/YYYY:HH:mm:ss ZZ'),
      status = request.status || '-',
      size = request.response
        ? Buffer.byteLength(JSON.stringify(request.response))
        : '-',
      referer = connection.headers.referer
        ? `"${connection.headers.referer}"`
        : '-',
      agent = connection.headers['user-agent']
        ? `"${connection.headers['user-agent']}"`
        : '-';


    this.logger.info(`${ip} - ${user} [${ts}] "${verb} ${url} ${protocol}" ${status} ${size} ${referer} ${agent}`);
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
      debug('Shutting down. Dropping request: %a', request);
      this._isShuttingDownError(request, cb);
      return;
    }

    debug('Funneling request: %a', request);

    global.kuzzle.funnel.execute(request, (error, result) => {
      const _res = result || request;

      if (error && !_res.error) {
        _res.setError(error);
      }

      this.logAccess(_res);

      const response = _res.response.toJSON();

      cb(removeErrorStack(response));
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
    const sanitized = removeErrorStack(data);

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

  _isShuttingDownError (request, cb) {
    request.setError(networkError.get('shutting_down'));
    this.logAccess(request);

    cb(removeErrorStack(request.response.toJSON()));
  }

  _notify (data) {
    debug(
      '[server] sending notification to client with connection id "%s": %a',
      data.connectionId,
      data);

    const client = this._clients.get(data.connectionId);

    if (!client || !client.protocol) {
      return;
    }

    try {
      this.protocols.get(client.protocol).notify(removeErrorStack(data));
    }
    catch (e) {
      global.kuzzle.log.error(`[notify] protocol ${client.protocol} failed: ${e.message}`);
    }
  }
}

module.exports = EntryPoint;
