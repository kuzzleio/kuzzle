/**
 * Main file when you type kuzzle start command
 *
 * This script will run both HTTP and Websocket server
 * for listen requests and handle them
 */

var
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

  if (!feature || (feature && (feature.workers === undefined || feature.workers === true))) {
    // initialize all hooks according to the configuration
    this.hooks.init();
    // initialize all workers according to the configuration
    this.workers.init();
  }

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
};