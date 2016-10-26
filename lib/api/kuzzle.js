var
  EventEmitter = require('eventemitter2').EventEmitter2,
  packageInfo = require('../../package.json'),
  path = require('path'),
  Dsl = require('./dsl'),
  EntryPoints = require('./core/entryPoints'),
  FunnelController = require('./controllers/funnelController'),
  HotelClerk = require('./core/hotelClerk'),
  Hooks = require('../hooks'),
  IndexCache = require('./core/indexCache'),
  InternalEngine = require('../services/internalEngine'),
  Notifier = require('./core/notifier'),
  PassportWrapper = require('./core/auth/passportWrapper'),
  PluginsManager = require('./core/plugins/pluginsManager'),
  Promise = require('bluebird'),
  RemoteActions = require('./remoteActions'),
  RemoteActionsController = require('./controllers/remoteActionsController'),
  Repositories = require('./core/models/repositories'),
  RouterController = require('./controllers/routerController'),
  Services = require('../services'),
  Statistics = require('./core/statistics'),
  TokenManager = require('./core/auth/tokenManager'),
  RequestObject = require('kuzzle-common-objects').Models.requestObject;

/** @typedef {{
 *   request: {
 *     maxRetainedRequests: {Number},
 *     maxConcurrentRequests: {Number},
 *     roleWithoutAdmin: *
 *   },
 *   server: Boolean,
 *   httpPort: Number,
 *   internalIndex: String,
 *   pluginsManager: {
 *     pipeWarnTime: Number,
 *     pipeTimeout: Number,
 *     dataCollection: String
 *   },
 *   userProfiles: {},
 *   userRoles: {},
 *   jsonWebToken: {
 *     secret: String
 *   },
 *   roleWithoutAdmin: {
 *     _id: String
 *   }
 * }} Params
 */

/**
 * @this {Kuzzle}
 * @constructor
 */
function Kuzzle () {
  /** @type {Params} */
  this.config = require('../config');

  this.config.apiVersion = packageInfo.apiVersion;
  this.config.version = packageInfo.version;

  this.rootPath = path.resolve(path.join(__dirname, '..', '..'));

  this.hooks = new Hooks(this);
  this.services = new Services(this);
  this.remoteActions = new RemoteActions(this);
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
  this.dsl = new Dsl(this);

  // Notifications core component
  this.notifier = new Notifier(this);

  // Statistics core component
  this.statistics = new Statistics(this);

  // Http server and websocket channel with proxy
  this.entryPoints = new EntryPoints(this);

  // The remote actions controller listens to remotes actions from other processes (like the CLI)
  this.remoteActionsController = new RemoteActionsController(this);

  /**
   * Flushes the internal storage components (internalEngine index, cache and memory storage=
   *
   * @this {Kuzzle}
   * @returns Promise
   */
  this.resetStorage = function kuzzleResetStorage () {
    this.pluginsManager.trigger('log:warn', 'Kuzzle::resetStorage called');

    return this.internalEngine.deleteIndex()
      .then(response => {
        var promises = ['internalCache', 'memoryStorage']
          .map(id => this.services.list[id].flushdb());

        return Promise.all(promises)
          .then(() => response);
      })
      .then(() => {
        this.indexCache.remove(this.internalEngine.index);
        return this.internalEngine.bootstrap.all();
      });
  };


  /**
   * Initializes all the needed components of a Kuzzle Server instance.
   *
   * By default, this script runs a standalone Kuzzle Server instance:
   *   - Internal services
   *   - Controllers
   *   - Hooks emitters
   *
   * @this {Kuzzle}
   */
  this.start = function kuzzleStart () {
    // Register crash dump
    registerErrorHandlers.call(this);

    return this.internalEngine.init()
      .then(() => this.internalEngine.bootstrap.all())
      .then(() => this.pluginsManager.packages.bootstrap())
      .then(() => this.pluginsManager.init(true))
      .then(() => this.pluginsManager.run())
      .then(() => this.services.init())
      .then(() => this.indexCache.init())
      .then(() => {
        this.pluginsManager.trigger('log:info', 'Services initiated');
        this.funnel.init();
        this.notifier.init();
        this.statistics.init();

        // Initialize hooks
        this.hooks.init();

        // Init all entry points in charge of listening to client queries (HTTP, Load balancer, MQ)
        this.entryPoints.init();

        return Promise.resolve();
      })
      .then(() => this.repositories.init())
      .then(() => {
        this.pluginsManager.trigger('log:info', 'Core components ready');

        // The remote actions controller listens to remotes actions from other processes (like the CLI) and passes them through the internal broker
        return this.remoteActionsController.init();
      })
      .then(() => {
        this.pluginsManager.trigger('core:kuzzleStart', 'Kuzzle is started');
        return Promise.resolve();
      })
      .catch(error => {
        this.pluginsManager.trigger('log:error', error);
        return Promise.reject(error);
      });
  };

}

// Add capability to listen/emit events for hooks
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
 */
function registerErrorHandlers() {
  var coreDumpSigals = {
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
  var request = new RequestObject({
    controller: 'actions',
    action: 'dump',
    body: {}
  });

  process.removeAllListeners('unhandledRejection');
  process.on('unhandledRejection', (err) => {
    console.error(`ERROR: unhandledRejection: ${err.message}`, err.stack); // eslint-disable-line no-console
    request.data.body.sufix = 'unhandled-rejection';
    this.remoteActionsController.actions.dump(request)
      .finally(() => {
        process.exit(1);
      });
  });

  process.removeAllListeners('uncaughtException');
  process.on('uncaughtException', (err) => {
    console.error(`ERROR: uncaughtException: ${err.message}`, err.stack); // eslint-disable-line no-console
    request.data.body.sufix = 'uncaught-exception';
    this.remoteActionsController.actions.dump(request)
      .finally(() => {
        process.exit(1);
      });
  });

  Object.keys(coreDumpSigals).forEach((signal) => {
    process.removeAllListeners(signal);
    process.on(signal, () => {
      console.error(`ERROR: Caught signal: ${signal}`); // eslint-disable-line no-console
      request.data.body.sufix = 'signal-'.concat(signal.toLowerCase());
      this.remoteActionsController.actions.dump(request)
        .finally(() => {
          process.exit(coreDumpSigals[signal] + 128);
        });
    });
  });

  // signal SIGTRAP is used to generate a kuzzle dump without stoping it
  process.removeAllListeners('SIGTRAP');
  process.on('SIGTRAP', () => {
    console.error('ERROR: Caught signal: SIGTRAP'); // eslint-disable-line no-console
    request.data.body.sufix = 'signal-sigtrap';
    this.remoteActionsController.actions.dump(request);
  });
}

module.exports = Kuzzle;
