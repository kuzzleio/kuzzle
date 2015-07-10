var
  captainsLog = require('captains-log'),
  // Load all configuration files (database, brokers...)
  config = require('../config'),
  // build all hooks defined in config/hooks.js file
  Hooks = require('../hooks'),
  // build all workers defined in config/worker.js file
  Workers = require('../workers'),
  // build all services
  Services = require('../services'),
  // Used for emit/listen event
  EventEmitter = require('events').EventEmitter;

function Kuzzle () {

  this.log = captainsLog();
  this.config = config;

  // Add hooks & workers & services
  this.hooks = new Hooks(this);
  this.workers = new Workers(this);
  this.services = new Services(this);
  this.services.init();

  // Add methods
  this.start = require('./start');
}

// Add capability to listen/emit events for hooks
Kuzzle.prototype = new EventEmitter();

module.exports = Kuzzle;