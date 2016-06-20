/**
 * Main file executed when you start Kuzzle
 *
 * You may change the default behavior by passing parameters to the kuzzle start command.
 */
var
  q = require('q'),
  packageInfo = require('../../package.json'),
  EntryPoints = require('./core/entryPoints'),
  HotelClerk = require('./core/hotelClerk'),
  Notifier = require('./core/notifier'),
  Statistics = require('./core/statistics'),
  WorkerListener = require('./core/workerListener'),
  TokenManager = require('./core/auth/tokenManager'),
  FunnelController = require('./controllers/funnelController'),
  RouterController = require('./controllers/routerController'),
  RemoteActionsController = require('./controllers/remoteActionsController'),
  Dsl = require('./dsl'),
  // Load all configuration files (database, brokers...)
  config = require('../config'),
  PluginsManager = require('./core/plugins/pluginsManager'),
  InternalEngine = require('../services/internalEngine'),
  IndexCache = require('./core/indexCache'),
  ClusterManager = require('./core/cluster/clusterManager');


/**
 * Initializes all the needed components of a Kuzzle instance.
 *
 * By default, this script runs a standalone Kuzzle instance:
 *   - Internal services
 *   - Controllers
 *   - Hooks emitters
 *   - A single set of workers
 *
 * @this {Kuzzle}
 * @param {Object} params command line and/or configuration file arguments
 *                        overrides the 'feature' argument
 * @param {Object} feature allow to programatically tune what part of Kuzzle you want to run
 */
module.exports = function start (params, feature) {
  var
    kuzzleStarted = q.defer();

  if (feature === undefined) {
    feature = {};
  }

  this.isServer = true;
  this.isWorker = false;

  if (params.server) {
    this.isServer = true;
    this.isWorker = false;
  }
  else if (params.worker) {
    this.isServer = false;
    this.isWorker = true;
  }
  this.config = config(params);
  this.config.apiVersion = packageInfo.apiVersion;
  this.config.version = packageInfo.version;

  this.internalEngine = new InternalEngine(this);
  this.internalEngine.init();

  this.pluginsManager = new PluginsManager(this);
  this.pluginsManager.init(this.isServer, feature.dummy)
    .then(() => this.pluginsManager.run())
    .then(() => {
      this.tokenManager = new TokenManager(this);
      this.indexCache = new IndexCache(this);

      if (this.isWorker) {
        return q();
      }

      if (feature.dummy) {
        this.isDummy = true;
        return this.services.init({server: false, whitelist: []});
      }

      return this.services.init({server: true})
        .then(() => {
          this.indexCache.init();
        });
    })
    .then(() => {

      if (this.isWorker) {
        // Start a single set of workers
        return this.workers.init({isDummy: feature.dummy});
      }
      
      // The funnel controller dispatch messages between the router controller and other controllers
      this.funnel = new FunnelController(this);
      this.funnel.init();

      // The router controller listens to client requests and pass them to the funnel controller
      this.router = new RouterController(this);

      // Room subscriptions core components
      this.hotelClerk = new HotelClerk(this);
      this.dsl = new Dsl(this);

      // Notifications core component
      this.notifier = new Notifier(this);
      this.notifier.init();

      // Statistics core component
      this.statistics = new Statistics(this);

      // Worker response listener
      this.workerListener = new WorkerListener(this, this.config.queues.workerWriteResponseQueue);

      // Create and init the Cluster
      this.clusterManager = new ClusterManager(this);
      this.entryPoints = new EntryPoints(this, params);

      if (!feature.dummy) {
        // Initialize hooks
        this.hooks.init();

        // Init all entry points in charge of listening to client queries (HTTP, Load balancer, MQ)
        this.entryPoints.init();
      }

      return q();
    })
    .then(() => {
      // the repositories need to be instanciated after the services are initialized
      this.repositories = require('./core/models/repositories')(this);

      // The remote actions controller listens to remotes actions from other processes (like the CLI) and passes them through the internal broker
      this.remoteActionsController = new RemoteActionsController(this);
      this.remoteActionsController.init();

      kuzzleStarted.resolve({});
    })
    .catch(error => {
      this.pluginsManager.trigger('log:error', error);
      kuzzleStarted.reject(error);
    });

  return kuzzleStarted.promise;
};
