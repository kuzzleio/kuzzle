var
  EventEmitter = require('eventemitter2').EventEmitter2,
  config = require('../config'),
  rc = require('rc'),
  packageInfo = require('../../package.json'),
  Hooks = require('../hooks'),
  Workers = require('../workers'),
  Services = require('../services'),
  PluginsManager = require('./core/plugins/pluginsManager'),
  InternalEngine = require('../services/internalEngine'),
  IndexCache = require('./core/indexCache');

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
 *   }
 * }} Params
 */

/**
 * @this {KuzzleWorker}
 * @constructor
 */
function KuzzleWorker () {
  this.isServer = false;
  this.isWorker = true;

  /** @type {Params} */
  this.rawParams = rc('kuzzle');

  this.config = config(this.rawParams);
  this.config.apiVersion = packageInfo.apiVersion;
  this.config.version = packageInfo.version;

  this.hooks = new Hooks(this);
  this.workers = new Workers(this);
  this.services = new Services(this);
  this.internalEngine = new InternalEngine(this);
  this.pluginsManager = new PluginsManager(this);
  this.indexCache = new IndexCache(this);

  /**
   * Initializes all the needed components of a Kuzzle Worker instance.
   *
   * @this {KuzzleWorker}
   * @param {Object} params command line and/or configuration file arguments
   *                        overrides the 'feature' argument
   * @param {Object} feature allow to programatically tune what part of Kuzzle you want to run
   */
  this.start = function (params, feature) {

    if (feature !== undefined && feature.dummy) {
      return Promise.resolve();
    }

    return this.internalEngine.init()
      .then(() => this.pluginsManager.init(false))
      .then(() => this.pluginsManager.run())
      .then(() => this.workers.init())
      .then(() => {
        this.pluginsManager.trigger('log:info', 'Core components ready');

        // the repositories need to be instanciated after the services are initialized
        this.repositories = require('./core/models/repositories')(this);

        this.pluginsManager.trigger('core:kuzzleStart', 'Kuzzle is started');

        return Promise.resolve();
      })
      .catch(error => {
        this.pluginsManager.trigger('log:error', error);
        return Promise.reject(error);
      });
  };

}

KuzzleWorker.prototype = new EventEmitter({
  wildcard: true,
  maxListeners: 30,
  delimiter: ':'
});

module.exports = KuzzleWorker;