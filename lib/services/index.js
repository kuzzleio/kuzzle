var
  q = require('q'),
  _ = require('lodash'),
  InternalError = require('kuzzle-common-objects').Errors.internalError;

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
module.exports = function (kuzzle) {
  this.list = {};
  this.kuzzle = kuzzle;

  /**
   * Initializes all services.
   * Even if a service is in the blacklist option, it will be instantiated (it won't be initialized though).
   * This allows togglable services.
   * For instance, Kuzzle can be started with some services down by default, and toggled 'on' later.
   *
   * @param options may contains the following properties:
   *            - blacklist (Array): the list of services that should not be initialized
   *            - server (Boolean): tells the service loader if it is invoked by a Kuzzle server instance or a
   *                                worker one
   */
  this.init = function (options) {
    var
      blacklist = [],
      whitelist = null,
      server = false,
      promises;

    if (options) {
      if (options.blacklist) {
        blacklist = options.blacklist;
      }
      if (options.whitelist) {
        whitelist = options.whitelist;
        blacklist = [];
      }

      server = options.server || false;
    }

    promises = Object.keys(kuzzle.config.services).map(service => {
      // We need to use a deferred promise here as the internalEngine (es) promises do not implement `finally`.
      var
        deferred = q.defer(),
        init,
        opt = {service, isServer: server};

      init = whitelist
        ? whitelist.indexOf(service) > -1
        : blacklist.indexOf(service) === -1;

      kuzzle.internalEngine
        .get(kuzzle.config.serviceSettingsCollection, service)
        .then(response => {
          opt = _.merge(opt, response._source);

          return registerService.call(this, service, opt, init)
            .then(deferred.resolve)
            .catch(deferred.reject);
        })
        .catch(err => {
          if (err.status === 404) {
            return registerService.call(this, service, opt, init)
              .then(deferred.resolve)
              .catch(deferred.reject);
          }

          return deferred.reject(err);
        });

      return deferred.promise;
    });
    
    return q.all(promises);
  };
};

function registerService (serviceName, opts, init) {
  var
    msg,
    services = this.kuzzle.config.services,
    timeout = opts.timeout || this.kuzzle.config.servicesDefaultInitTimeout;

  try {
    this.list[serviceName] = new (require('./' + services[serviceName]))(this.kuzzle, opts);
  }
  catch (error) {
    msg =`File services/${services[serviceName]}.js not found ` +
        `to initialize service ${serviceName}`;
    this.kuzzle.pluginsManager.trigger('log:error', msg);
    throw new InternalError(msg);
  }

  if (!init) {
    return q();
  }

  return this.list[serviceName].init()
    .timeout(timeout, '___timedOut')
    .catch(err => {
      if (err.message === '___timedOut') {
        throw new InternalError(`[FATAL] Service "${serviceName}" failed to init within ${timeout}ms`);
      }

      throw err;
    });
}

