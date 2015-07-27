
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



module.exports = function perf (params, feature) {

  if (!feature || (feature && (feature.workers === undefined || feature.workers === true))) {
    // initialize all hooks according to the configuration
    this.hooks.init();

    var controllers = ['write', 'read', 'admin', 'bulk'];

    controllers.forEach(function (controller) {
      this.hooks.add(controller+':rest:start', 'log:log');
      this.hooks.add(controller+':rest:funnel:reject', 'log:log');
      this.hooks.add(controller+':rest:stop', 'log:log');

      this.hooks.add(controller+':mq:start', 'log:log');
      this.hooks.add(controller+':mq:funnel:reject', 'log:log');
      this.hooks.add(controller+':mq:stop', 'log:log');

      this.hooks.add(controller+':websocket:start', 'log:log');
      this.hooks.add(controller+':websocket:funnel:reject', 'log:log');
      this.hooks.add(controller+':websocket:stop', 'log:log');
    }.bind(this));

    this.hooks.add('data:create', 'log:log');
    this.hooks.add('data:update', 'log:log');
    this.hooks.add('data:delete', 'log:log');
    this.hooks.add('data:deleteByQuery', 'log:log');
    this.hooks.add('data:bulkImport', 'log:log');
    this.hooks.add('data:deleteCollection', 'log:log');
    this.hooks.add('data:putMapping', 'log:log');

    this.hooks.add('remcustomerfromallroom:start', 'log:log');
    this.hooks.add('remcustomerfromallroom:error', 'log:error');
    this.hooks.add('remcustomerfromallroom:stop', 'log:log');

    this.hooks.add('filter:start', 'log:log');
    this.hooks.add('filter:error', 'log:error');
    this.hooks.add('filter:stop', 'log:log');

    this.hooks.add('remsub:start', 'log:log');
    this.hooks.add('remsub:stop', 'log:log');

    this.hooks.add('addsub:start', 'log:log');
    this.hooks.add('addsub:stop', 'log:log');

    this.hooks.add('websocket:disconnect', 'log:log');
    this.hooks.add('websocket:error', 'log:log');


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
