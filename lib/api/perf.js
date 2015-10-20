
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
  Statistics = require('./core/statistics'),
  FunnelController = require('./controllers/funnelController'),
  RouterController = require('./controllers/routerController'),
  Dsl = require('./dsl'),
  // Load all configuration files (database, brokers...)
  config = require('../config');


module.exports = function perf (params, feature) {
  var
    kuzzleStarted = q.defer(),
    eventWithStartAndStop = ['write', 'read', 'admin', 'bulk'];

  if (feature === undefined) {
    feature = {};
  }

  if (params.server) {
    feature.servers = true;
    feature.workers = false;
  }
  else if (params.worker) {
    feature.servers = false;
    feature.workers = true;
  }

  this.config = config(params);

  if (!feature.workers) {
    this.services.init({server: (!feature.dummy) });

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

    if (!feature.dummy) {
      servers.initAll(this, params);

      this.hooks.init();

      eventWithStartAndStop.forEach(function(eventName) {
        this.hooks.add(eventName + ':rest:start', 'perf:log');
        this.hooks.add(eventName + ':rest:stop', 'perf:log');

        this.hooks.add(eventName + ':mq:start', 'perf:log');
        this.hooks.add(eventName + ':mq:stop', 'perf:log');

        this.hooks.add(eventName + ':websocket:start', 'perf:log');
        this.hooks.add(eventName + ':websocket:stop', 'perf:log');
      }.bind(this));

      this.hooks.add('writefunnel:reject', 'perf:log');
      this.hooks.add('bulkfunnel:reject', 'perf:log');
      this.hooks.add('adminfunnel:reject', 'perf:log');

      this.hooks.add('remcustomerfromallroom:error', 'perf:error');
      this.hooks.add('filter:error', 'perf:error');
      this.hooks.add('remsub:error', 'perf:error');

      this.hooks.add('websocket:disconnect', 'perf:log');
      this.hooks.add('websocket:error', 'perf:log');
    }
  }

  // Start a single set of workers
  if (feature.workers === undefined || feature.workers === true) {
    this.workers.init();
  }

  kuzzleStarted.resolve({});

  return kuzzleStarted.promise;
};
