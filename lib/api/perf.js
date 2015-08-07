
/**
 * Main file when you type kuzzle start command in performance mode
 * it basically do everything "start.js" file do, plus it plugs actions
 *   on hooks "read:start", "write:start"," "admin:start","bulk:start"
 *  "read:stop", "write:stop"," "admin:stop","bulk:stop"...
 *
 */

var
  q = require('q'),
  servers = require('./core/servers'),
  HotelClerk = require('./core/hotelClerk'),
  Notifier = require('./core/notifier'),
  FunnelController = require('./controllers/funnelController'),
  RouterController = require('./controllers/routerController'),
  Dsl = require('./dsl');


module.exports = function perf (params, feature) {
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
    var eventWithStartAndStop = ['write', 'read', 'admin', 'bulk'];

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
        servers.initAll(this, params);

        this.hooks.init();

        this.hooks.add('test:getTestParam', 'log:getTestParam');

        eventWithStartAndStop.forEach(function(eventName) {
          this.hooks.add(eventName + ':rest:start', 'log:log');
          this.hooks.add(eventName + ':rest:stop', 'log:log');

          this.hooks.add(eventName + ':mq:start', 'log:log');
          this.hooks.add(eventName + ':mq:stop', 'log:log');

          this.hooks.add(eventName + ':websocket:start', 'log:log');
          this.hooks.add(eventName + ':websocket:stop', 'log:log');
        }.bind(this));

        this.hooks.add('data:create', 'log:log');
        this.hooks.add('data:update', 'log:log');
        this.hooks.add('data:delete', 'log:log');
        this.hooks.add('data:deleteByQuery', 'log:log');
        this.hooks.add('data:bulkImport', 'log:log');
        this.hooks.add('data:deleteCollection', 'log:log');
        this.hooks.add('data:putMapping', 'log:log');

        this.hooks.add('writefunnel:reject', 'log:log');
        this.hooks.add('bulkfunnel:reject', 'log:log');
        this.hooks.add('adminfunnel:reject', 'log:log');

        this.hooks.add('remcustomerfromallroom:error', 'log:error');
        this.hooks.add('filter:error', 'log:error');
        this.hooks.add('remsub:error', 'log:error');

        this.hooks.add('websocket:disconnect', 'log:log');
        this.hooks.add('websocket:error', 'log:log');

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
