var
  EventEmitter = require('eventemitter2').EventEmitter2,
  // build all hooks defined in config/hooks.js file
  Hooks = require('../hooks'),
  // build all workers defined in config/worker.js file
  Workers = require('../workers'),
  // build all services
  Services = require('../services'),
  // add remote action router
  RemoteActions = require('./remoteActions'),
  rc = require('rc');

/** @typedef {{
 *   request: {
 *     maxRetainedRequests: {Number},
 *     maxConcurrentRequests: {Number},
 *     roleWithoutAdmin: *
 *   },
 *   server: Boolean,
 *   worker: Boolean,
 *   httpPort: Number,
 *   internalIndex: String,
 *   pluginsManager: {
 *     pipeWarnTime: Number,
 *     pipeTimeout: Number,
 *     dataCollection: String
 *   },
 *   userProfiles: {},
 *   userRoles: {},
 *   jsonWebToken: {
 *     secret: String
 *   },
 *   roleWithoutAdmin: {
 *     _id: String
 *   },
 *   mqBroker: {
 *     host: String
 *     port: Number
 *   }
 * }} Params
 */

/**
 * @this {Kuzzle}
 * @constructor
 */
function Kuzzle () {
  /** @type {Params} */
  this.rawParams = rc('kuzzle');

  // Current Kuzzle state: is a worker or a server ?
  if (this.rawParams.server) {
    this.isServer = true;
    this.isWorker = false;
  }
  else if (this.rawParams.worker) {
    this.isWorker = true;
    this.isServer = false;
  }

  // Add hooks, workers, services and remote actions
  this.hooks = new Hooks(this);
  this.workers = new Workers(this);
  this.services = new Services(this);
  this.remoteActions = new RemoteActions(this);

  // Add methods
  this.start = require('./start');
}

// Add capability to listen/emit events for hooks
Kuzzle.prototype = new EventEmitter({
  wildcard: true,
  maxListeners: 30,
  delimiter: ':'
});

module.exports = Kuzzle;