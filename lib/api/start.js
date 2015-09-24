/**
 * Main file executed when you start Kuzzle
 *
 * You may change the default behavior by passing parameters to the kuzzle start command.
 */
var
  q = require('q'),
  servers = require('./core/servers'),
  HotelClerk = require('./core/hotelClerk'),
  Notifier = require('./core/notifier'),
  FunnelController = require('./controllers/funnelController'),
  RouterController = require('./controllers/routerController'),
  Dsl = require('./dsl'),
  // Load all configuration files (database, brokers...)
  config = require('../config'),
  PluginsManager = require('./core/pluginsManager');

/**
 * Initializes all the needed components of a Kuzzle instance.
 *
 * By default, this script runs a standalone Kuzzle instance:
 *   - Internal services
 *   - Controllers
 *   - Hooks emitters
 *   - A single set of workers
 *
 * @param {Object} params command line and/or configuration file arguments
 *                        overrides the 'feature' argument
 * @param {Object} feature allow to programatically tune what part of Kuzzle you want to run
 */
module.exports = function start (params, feature) {
  var
    kuzzleStarted = q.defer(),
    pluginLoaded;

  if (feature === undefined) {
    feature = {};
  }

  if (params.server) {
    this.isServer = true;
    this.isWorker = false;
  }
  else {
    if (params.worker) {
      this.isServer = false;
      this.isWorker = true;
    }
  }

  this.config = config(params);

  if (!feature.dummy) {
    this.pluginsManager = new PluginsManager();

    if (this.isServer) {
      this.pluginsManager.init();
    }
  }

  if (!this.isWorker) {
    if (!feature.dummy) {
      this.services.init({server: true});
    }
    else {
      this.services.init({server: false, blacklist: ['mqBroker', 'logger', 'writeEngine', 'readEngine', 'notificationCache', 'monitoring', 'remoteActions', 'profiling']});
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
    this.notifier.init(this);

    if (!feature.dummy) {
      // Initialize hooks
      this.hooks.init();

      // Starts the servers in charge of listening to client queries (HTTP, MQ or WebSocket)
      servers.initAll(this, params);
    }
  }

  // Start a single set of workers
  if (this.isWorker === undefined || this.isWorker === true) {
    this.workers.init();
  }

  kuzzleStarted.resolve({});
  return kuzzleStarted.promise;
};