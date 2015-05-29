/**
 * Main file when you type kuzzle start command
 *
 * This script will run both HTTP and Websocket server
 * for listen requests and handle them
 */

var
  servers = require('./private/servers'),
  FunnelController = require('./controllers/funnelController'),
  RouterController = require('./controllers/routerController'),
  HotelClerkController = require('./controllers/hotelClerkController'),
  Dsl = require('./dsl');


/**
 * Init all thing needed: funnel, hotelClerk and dsl
 * This function will also load hooks, workers and server
 *
 * @param {Object} params
 * @param {Object} stack allow to specify what need to be run
 */
module.exports = function start (params, stack) {

  if (!stack || !stack.workers) {
    // initialize all hooks according to the configuration
    this.hooks.init();
    // initialize all workers according to the configuration
    this.workers.init();
  }

  // Instantiate the FunnelController for dispatch request from user
  this.funnel = new FunnelController(this);
  this.funnel.init();
  this.router = new RouterController(this);

  // Init the controller that will create and destroy room and associate user with room
  this.hotelClerk = new HotelClerkController(this);
  this.dsl = new Dsl(this);

  if (!stack || !stack.servers) {
    servers.initAll(this, params);
  }


  /**
   process.on('SIGINT', function() {
		this.workers.shutdown();
	}.bind(this));
   */
};