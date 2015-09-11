var
  captainsLog = require('captains-log'),
  EventEmitter = require('events').EventEmitter,
  // build all hooks defined in config/hooks.js file
  Hooks = require('../hooks'),
  // build all workers defined in config/worker.js file
  Workers = require('../workers'),
  // build all services
  Services = require('../services'),
  rc = require('rc');

function Kuzzle () {
  var params = rc('kuzzle');

  // Current Kuzzle state: is a worker or a server ?
  if (params.server) {
    this.isServer = true;
    this.isWorker = false;
  }
  else if (params.worker) {
      this.isWorker = true;
      this.isServer = false;
  }

  this.log = captainsLog();

  // Add hooks, workers and services
  this.hooks = new Hooks(this);
  this.workers = new Workers(this);
  this.services = new Services(this);

  // Add methods
  this.cleanDb = require('./cleanDb');
  this.prepareDb = require('./prepareDb');
  this.start = require('./start');
  this.perf = require('./perf');
  this.enable = require('./enable');
}

// Add capability to listen/emit events for hooks
Kuzzle.prototype = new EventEmitter();

module.exports = Kuzzle;