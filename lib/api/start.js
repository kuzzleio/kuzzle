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
  Dsl = require('./dsl');

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
    internalBrokerStarted,
    kuzzleStarted = q.defer();

  this.services.init();

  if (feature === undefined) {
    feature = {};
  }

  if (params.server) {
    feature.servers = true;
    feature.workers = false;
  }
  else {
    if (params.worker) {
      feature.servers = false;
      feature.workers = true;
    }
  }
  // Starts the internal broker server
  if (!feature.dummy && (feature.servers === undefined || feature.servers === true)) {
    internalBrokerStarted = this.services.list.broker.start();
  }
  else {
    internalBrokerStarted = Promise.resolve('No server mode');
  }

  internalBrokerStarted.then(function () {
    if (feature.servers === undefined || feature.servers === true) {
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
    if (feature.workers === undefined || feature.workers === true) {
      this.workers.init();
    }

    this.log.info('-- KUZZLE INITIALIZATION COMPLETE' +
      (params.server ? ': SERVER MODE' : params.worker ? ': WORKER MODE' : '')
    );

    kuzzleStarted.resolve({});
  }.bind(this));

  return kuzzleStarted.promise;
};