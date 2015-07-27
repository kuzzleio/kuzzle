/**
 * Main file when you type kuzzle start command
 *
 * This script will run both HTTP and Websocket server
 * for listen requests and handle them
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
 * Init all thing needed: funnel, hotelClerk and dsl
 * This function will also load hooks, workers and server
 *
 * @param {Object} params
 * @param {Object} feature allow to specify what need to be run
 */
module.exports = function start (params, feature) {
  var
    internalBrokerStarted,
    kuzzleStarted = q.defer();

  // Starts the IPC internal broker
  if (!feature || (feature && (feature.servers === undefined || feature.servers === true))) {
    internalBrokerStarted = this.services.list.broker.startServer();
  }
  else {
    internalBrokerStarted = Promise.resolve('No server mode');
  }

  internalBrokerStarted.then(function () {
      // Instantiate the FunnelController for dispatch request from user
      this.funnel = new FunnelController(this);
      this.funnel.init();
      this.router = new RouterController(this);

      // Initialize the core component which will create and destroy room and associate user with room
      this.hotelClerk = new HotelClerk(this);
      this.dsl = new Dsl(this);

      // Initialize the notifier core component
      this.notifier = new Notifier(this);
      this.notifier.init(this);

      if (!feature || (feature && (feature.servers === undefined || feature.servers === true))) {
        servers.initAll(this, params);
      }

      // initialize all hooks and workers according to the configuration
      if (!feature || (feature && (feature.workers === undefined || feature.workers === true))) {
        this.hooks.init();
        this.workers.init();
      }

    kuzzleStarted.resolve({});
  }.bind(this));

  return kuzzleStarted.promise;
};