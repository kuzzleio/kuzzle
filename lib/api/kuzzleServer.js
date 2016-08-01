var
  EventEmitter = require('eventemitter2').EventEmitter2,
  config = require('../config'),
  rc = require('rc'),
  packageInfo = require('../../package.json'),
  ClusterManager = require('./core/cluster/clusterManager'),
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
  RemoteActions = require('./remoteActions'),
  RemoteActionsController = require('./controllers/remoteActionsController'),
  Repositories = require('./core/models/repositories'),
  RouterController = require('./controllers/routerController'),
  Services = require('../services'),
  Statistics = require('./core/statistics'),
  TokenManager = require('./core/auth/tokenManager'),
  WorkerListener = require('./core/workerListener'),
  Workers = require('../workers');

/** @typedef {{
 *   request: {
 *     maxRetainedRequests: {Number},
 *     maxConcurrentRequests: {Number},
 *     roleWithoutAdmin: *
 *   },
 *   server: Boolean,
 *   worker: Boolean,
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
 * @this {KuzzleServer}
 * @constructor
 */
function KuzzleServer () {
  this.isServer = true;
  this.isWorker = false;

  /** @type {Params} */
  this.rawParams = rc('kuzzle');

  this.config = config(this.rawParams);
  this.config.apiVersion = packageInfo.apiVersion;
  this.config.version = packageInfo.version;

  this.hooks = new Hooks(this);
  this.workers = new Workers(this);
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

  // Worker response listener
  this.workerListener = new WorkerListener(this);

  // Create and init the Cluster
  this.clusterManager = new ClusterManager(this);
  this.entryPoints = new EntryPoints(this, this.rawParams);

  // The remote actions controller listens to remotes actions from other processes (like the CLI) and passes them through the internal broker
  this.remoteActionsController = new RemoteActionsController(this);

  /**
   * Initializes all the needed components of a Kuzzle Server instance.
   *
   * By default, this script runs a standalone Kuzzle Server instance:
   *   - Internal services
   *   - Controllers
   *   - Hooks emitters
   *   - A single set of workers
   *
   * @this {KuzzleServer}
   * @param {Object} params command line and/or configuration file arguments
   *                        overrides the 'feature' argument
   * @param {Object} [feature={}] allow to programatically tune what part of Kuzzle you want to run
   */
  this.start = function (params, feature) {

    if (feature !== undefined && feature.dummy) {
      return Promise.resolve();
    }

    return this.internalEngine.init()
      .then(() => this.pluginsManager.init(true))
      .then(() => this.pluginsManager.run())
      .then(() => this.services.init({server: true}))
      .then(() => this.indexCache.init())
      .then(() => {
        this.pluginsManager.trigger('log:info', 'Services initiated');
        this.funnel.init();
        this.notifier.init();
        this.statistics.init();
        this.workerListener.startListener(this.config.queues.workerWriteResponseQueue);

        // init the Cluster
        this.clusterManager.init();
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
KuzzleServer.prototype = new EventEmitter({
  wildcard: true,
  maxListeners: 30,
  delimiter: ':'
});

module.exports = KuzzleServer;