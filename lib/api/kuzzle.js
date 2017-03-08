'use strict';

// add support for ES6 modules ("import ... from ...")
require('reify');

const
  EventEmitter = require('eventemitter2').EventEmitter2,
  packageInfo = require('../../package.json'),
  path = require('path'),
  Dsl = require('./dsl'),
  EntryPoints = require('./core/entryPoints'),
  FunnelController = require('./controllers/funnelController'),
  HotelClerk = require('./core/hotelClerk'),
  IndexCache = require('./core/indexCache'),
  InternalEngine = require('../services/internalEngine'),
  GarbageCollector = require('../services/garbageCollector'),
  Notifier = require('./core/notifier'),
  PassportWrapper = require('./core/auth/passportWrapper'),
  PluginsManager = require('./core/plugins/pluginsManager'),
  Promise = require('bluebird'),
  Cli = require('./cli'),
  CliController = require('./controllers/cliController'),
  Repositories = require('./core/models/repositories'),
  RouterController = require('./controllers/routerController'),
  Services = require('../services'),
  Statistics = require('./core/statistics'),
  TokenManager = require('./core/auth/tokenManager'),
  Validation = require('./core/validation'),
  Request = require('kuzzle-common-objects').Request;

/**
 * @this {Kuzzle}
 * @constructor
 */
function Kuzzle () {
  /** @type {KuzzleConfiguration} */
  this.config = require('../config');
  this.config.version = packageInfo.version;

  this.rootPath = path.resolve(path.join(__dirname, '..', '..'));

  this.services = new Services(this);
  this.cli = new Cli(this);
  this.internalEngine = new InternalEngine(this);
  this.pluginsManager = new PluginsManager(this);
  this.tokenManager = new TokenManager(this);
  this.indexCache = new IndexCache(this);
  this.repositories = new Repositories(this);

  this.gc = new GarbageCollector(this);

  this.passport = new PassportWrapper();

  // The funnel controller dispatch messages between the router controller and other controllers
  this.funnel = new FunnelController(this);

  // The router controller listens to client requests and pass them to the funnel controller
  this.router = new RouterController(this);

  // Room subscriptions core components
  this.hotelClerk = new HotelClerk(this);

  /** @type {RealtimeEngine} */
  this.dsl = new Dsl(this);

  // Notifications core component
  /** @type {Notifier} */
  this.notifier = new Notifier(this);

  // Statistics core component
  this.statistics = new Statistics(this);

  this.cliController = new CliController(this);

  // Http server and websocket channel with proxy
  this.entryPoints = new EntryPoints(this);

  /**
   * Flushes the internal storage components (internalEngine index, cache and memory storage)
   *
   * @this {Kuzzle}
   * @returns Promise
   */
  this.resetStorage = function kuzzleResetStorage () {
    this.pluginsManager.trigger('log:warn', 'Kuzzle::resetStorage called');

    return this.internalEngine.deleteIndex()
      .then(response => {
        let promises = ['internalCache', 'memoryStorage']
          .map(id => this.services.list[id].flushdb());

        return Promise.all(promises).then(() => response);
      })
      .then(() => {
        this.indexCache.remove(this.internalEngine.index);
        return this.internalEngine.bootstrap.all();
      });
  };

  // Validation core component
  this.validation = new Validation(this);

  /**
   * Initializes all the needed components of a Kuzzle Server instance.
   *
   * By default, this script runs a standalone Kuzzle Server instance:
   *   - Internal services
   *   - Controllers
   *
   * @this {Kuzzle}
   */
  this.start = function kuzzleStart () {
    // Register crash dump if enabled
    if (this.config.dump.enabled) {
      registerErrorHandlers(this);
    }

    return this.internalEngine.init()
      .then(() => this.internalEngine.bootstrap.all())
      .then(() => this.validation.init())
      .then(() => this.pluginsManager.init(true))
      .then(() => this.pluginsManager.run())
      .then(() => this.services.init())
      .then(() => this.indexCache.init())
      .then(() => this.gc.init())
      .then(() => {
        this.pluginsManager.trigger('log:info', 'Services initiated');
        this.funnel.init();
        this.router.init();
        this.notifier.init();
        this.statistics.init();

        return Promise.resolve();
      })
      .then(() => this.repositories.init())
      .then(() => this.validation.curateSpecification())
      .then(() => {
        this.cliController.init();
        this.entryPoints.init();
        this.pluginsManager.trigger('core:kuzzleStart', 'Kuzzle is started');

        return Promise.resolve();
      })
      .catch(error => {
        this.pluginsManager.trigger('log:error', error);
        return Promise.reject(error);
      });
  };
}

// Add capability to listen/emit events
Kuzzle.prototype = new EventEmitter({
  wildcard: true,
  maxListeners: 30,
  delimiter: ':'
});

Kuzzle.prototype.constructor = Kuzzle;

/**
 * Register handlers and do a kuzzle dump for:
 * - system signals
 * - unhandled-rejection
 * - uncaught-exception
 *
 * @param {Kuzzle} kuzzle
 */
function registerErrorHandlers(kuzzle) {
  const coreDumpSigals = {
    SIGHUP: 1,
    // SIGINT: 2,
    SIGQUIT: 3,
    // SIGILL: 4, can not be handled
    SIGABRT: 6,
    // SIGFPE: 8, can not be handled
    // SIGKILL: 9, can not be handled
    // SIGSEGV: 11, can not be handled
    SIGPIPE: 13,
    // SIGBUS: 10, can not be handled
    SIGTERM: 15,
  };
  const request = new Request({
    controller: 'actions',
    action: 'dump',
    body: {}
  });

  // Remove external listeners (PM2) to avoid other listeners to exit current process
  process.removeAllListeners('unhandledRejection');
  process.on('unhandledRejection', (err) => {
    console.error(`ERROR: unhandledRejection: ${err.message}`, err.stack); // eslint-disable-line no-console
    request.input.body.suffix = 'unhandled-rejection';
    kuzzle.cliController.actions.dump(request)
      .finally(() => {
        process.exit(1);
      });
  });

  process.removeAllListeners('uncaughtException');
  process.on('uncaughtException', (err) => {
    console.error(`ERROR: uncaughtException: ${err.message}`, err.stack); // eslint-disable-line no-console
    request.input.body.suffix = 'uncaught-exception';
    kuzzle.cliController.actions.dump(request)
      .finally(() => {
        process.exit(1);
      });
  });

  Object.keys(coreDumpSigals).forEach((signal) => {
    process.removeAllListeners(signal);
    process.on(signal, () => {
      console.error(`ERROR: Caught signal: ${signal}`); // eslint-disable-line no-console
      request.input.body.suffix = 'signal-'.concat(signal.toLowerCase());
      kuzzle.cliController.actions.dump(request)
        .finally(() => {
          process.exit(coreDumpSigals[signal] + 128);
        });
    });
  });

  // signal SIGTRAP is used to generate a kuzzle dump without stoping it
  process.removeAllListeners('SIGTRAP');
  process.on('SIGTRAP', () => {
    console.error('ERROR: Caught signal: SIGTRAP'); // eslint-disable-line no-console
    request.input.body.suffix = 'signal-sigtrap';
    kuzzle.cliController.actions.dump(request);
  });
}

module.exports = Kuzzle;
