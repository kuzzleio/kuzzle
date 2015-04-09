/**
 * Main file when you type kuzzle start command
 *
 * This script will run both HTTP and Websocket server
 * for listen requests and handle them
 */

var
  servers = require('./private/servers'),
  FunnelController = require('./controllers/funnelController'),
  RouterController = require('./controllers/routerController');


module.exports = function start (params) {

  // initialize all hooks according to the configuration
  this.hooks.init();
  // initialize all workers according to the configuration
  this.workers.init();

  // Instantiate the FunnelController for dispatch request from user
  this.funnel = new FunnelController(this);
  this.funnel.init();
  this.router = new RouterController(this);

  servers.initAll(this, params);


  /**
   process.on('SIGINT', function() {
		this.workers.shutdown();
	}.bind(this));
   */
};