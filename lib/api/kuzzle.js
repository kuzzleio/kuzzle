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
  EventEmitter = require('eventemitter2').EventEmitter2,
  config = require('../config'),
  packageInfo = require('../../package.json'),
  path = require('path'),
  highwayhash = require('highwayhash'),
  stringify = require('json-stable-stringify'),
  Koncorde = require('koncorde'),
  EntryPoints = require('./core/entrypoints'),
  FunnelController = require('./controllers/funnelController'),
  HotelClerk = require('./core/hotelClerk'),
  IndexCache = require('./core/indexCache'),
  InternalEngine = require('../services/internalEngine'),
  Notifier = require('./core/notifier'),
  PassportWrapper = require('./core/auth/passportWrapper'),
  PluginsManager = require('./core/plugins/pluginsManager'),
  Bluebird = require('bluebird'),
  Cli = require('./cli'),
  CliController = require('./controllers/cliController'),
  Repositories = require('./core/models/repositories'),
  RouterController = require('./controllers/routerController'),
  Services = require('../services'),
  Statistics = require('./core/statistics'),
  TokenManager = require('./core/auth/tokenManager'),
  Validation = require('./core/validation'),
  Request = require('kuzzle-common-objects').Request,
  InternalEngineBootstrap = require('../services/internalEngine/bootstrap');

/**
 * @class Kuzzle
 * @extends EventEmitter
 */
class Kuzzle extends EventEmitter {
  constructor() {
    super({
      verboseMemoryLeak: true,
      wildcard: true,
      maxListeners: 30,
      delimiter: ':'
    });

    /** @type {KuzzleConfiguration} */
    this.config = config;
    this.config.version = packageInfo.version;

    this.rootPath = path.resolve(path.join(__dirname, '..', '..'));

    this.services = new Services(this);
    this.cli = new Cli(this);
    this.internalEngine = new InternalEngine(this);
    this.pluginsManager = new PluginsManager(this);
    this.tokenManager = new TokenManager(this);
    this.indexCache = new IndexCache(this);
    this.repositories = new Repositories(this);

    this.passport = new PassportWrapper();

    // The funnel controller dispatch messages between the router controller and other controllers
    this.funnel = new FunnelController(this);

    // The router controller listens to client requests and pass them to the funnel controller
    this.router = new RouterController(this);

    // Room subscriptions core components
    this.hotelClerk = new HotelClerk(this);

    // Notifications core component
    /** @type {Notifier} */
    this.notifier = new Notifier(this);

    // Statistics core component
    this.statistics = new Statistics(this);

    this.cliController = new CliController(this);

    // Http server and websocket channel with server
    this.entryPoints = new EntryPoints(this);

    // Validation core component
    this.validation = new Validation(this);
  }

  /**
   * Initializes all the needed components of a Kuzzle Server instance.
   *
   * By default, this script runs a standalone Kuzzle Server instance:
   *   - Internal services
   *   - Controllers
   *
   * @this {Kuzzle}
   */
  start() {
    const internalEngineBootstrap = new InternalEngineBootstrap(this, this.internalEngine);
    // Register crash dump if enabled
    if (this.config.dump.enabled) {
      registerErrorHandlers(this);
    }

    return this.internalEngine.init(internalEngineBootstrap)
      .then(() => this.internalEngine.bootstrap.all())
      .then(() => this.services.init())
      .then(() => this.validation.init())
      .then(() => this.indexCache.init())
      .then(() => this.funnel.init())
      .then(() => this.pluginsManager.init())
      .then(() => this.pluginsManager.run())
      .then(() => this.pluginsManager.trigger('log:info', 'Services initiated'))
      .then(() => {
        this.funnel.loadPluginControllers();
        this.router.init();
        this.statistics.init();

        /** @type {RealtimeEngine} */
        this.realtime = new Koncorde({
          seed: this.config.internal.hash.seed,
          maxMinTerms: this.config.limits.subscriptionMinterms
        });

        return this.repositories.init();
      })
      .then(() => this.validation.curateSpecification())
      .then(() => {
        this.cliController.init();
        this.entryPoints.init();
        this.pluginsManager.trigger('core:kuzzleStart', 'Kuzzle is started');

        return Bluebird.resolve();
      })
      .catch(error => {
        this.pluginsManager.trigger('log:error', error);
        return Bluebird.reject(error);
      });
  }

  static hash (input) {
    let inString;

    switch (typeof input) {
      case 'string':
      case 'number':
      case 'boolean':
        inString = input;
        break;
      default:
        inString = stringify(input);
    }

    return highwayhash.asHexString(config.internal.hash.seed, Buffer.from(inString));
  }
}

/**
 * Register handlers and do a kuzzle dump for:
 * - system signals
 * - unhandled-rejection
 * - uncaught-exception
 *
 * @param {Kuzzle} kuzzle
 */
function registerErrorHandlers(kuzzle) {
  const coreDumpSignals = {
    SIGQUIT: 3,
    // SIGILL: 4, can not be handled
    SIGABRT: 6,
    // SIGFPE: 8, can not be handled
    // SIGKILL: 9, can not be handled
    // SIGSEGV: 11, can not be handled
    SIGPIPE: 13
    // SIGBUS: 10, can not be handled
  };
  const request = new Request({
    controller: 'actions',
    action: 'dump',
    body: {}
  });

  // Remove external listeners (PM2) to avoid other listeners to exit current process
  process.removeAllListeners('unhandledRejection');
  process.on('unhandledRejection', err => {
    console.error(`ERROR: unhandledRejection: ${err.message}`, err.stack); // eslint-disable-line no-console

    // dump+exit is a good idea during development as it helps
    // spotting code errors. But in production, these problems
    // should only come from plugins, and it seems a really bad idea
    // to stop Kuzzle because a plugin created an unchained, uncatchable
    // promise that got rejected
    if (process.env.NODE_ENV !== 'production') {
      request.input.args.suffix = 'unhandled-rejection';
      kuzzle.cliController.actions.dump(request).finally(() => process.exit(1));
    }
  });

  process.removeAllListeners('uncaughtException');
  process.on('uncaughtException', err => {
    console.error(`ERROR: uncaughtException: ${err.message}`, err.stack); // eslint-disable-line no-console
    request.input.args.suffix = 'uncaught-exception';
    kuzzle.cliController.actions.dump(request)
      .finally(() => process.exit(1));
  });

  // abnormal termination signals => generate a core dump
  Object.keys(coreDumpSignals).forEach(signal => {
    process.removeAllListeners(signal);
    process.on(signal, () => {
      console.error(`ERROR: Caught signal: ${signal}`); // eslint-disable-line no-console
      request.input.args.suffix = 'signal-'.concat(signal.toLowerCase());
      kuzzle.cliController.actions.dump(request)
        .finally(() => process.exit(coreDumpSignals[signal] + 128));
    });
  });

  // signal SIGTRAP is used to generate a kuzzle dump without stopping it
  process.removeAllListeners('SIGTRAP');
  process.on('SIGTRAP', () => {
    console.error('Caught signal SIGTRAP => generating a core dump'); // eslint-disable-line no-console
    request.input.args.suffix = 'signal-sigtrap';
    kuzzle.cliController.actions.dump(request);
  });

  // gracefully exits on normal termination
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.removeAllListeners(signal);
    process.on(signal, () => kuzzle.cliController.actions.shutdown());
  }
}

module.exports = Kuzzle;
