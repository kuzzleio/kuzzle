var
  q = require('q'),
  _ = require('lodash');

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
      whitelist = [],
      server = false,
      services = this.kuzzle.config.services,
      promises,
      registerService;

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

    registerService = (serviceName, opts) => {
      var init = false;

      this.list[serviceName] = new (require('./' + services[serviceName]))(kuzzle, opts);

      if (whitelist.length) {
        init = whitelist.indexOf(serviceName) > -1;
      }
      else {
        init = blacklist.indexOf(serviceName) === -1;
      }

      if (init) {
        return q(this.list[serviceName].init());
      }
      return q();
    };

    promises = Object.keys(services).map(serviceName => {
      return (service => {
        var
          deferred = q.defer(),
          opt = {service: serviceName, isServer: server};

        kuzzle.internalEngine
          .get(kuzzle.config.serviceSettingsCollection, service)
          .then(response => {
            opt = _.merge(opt, response._source);

            return registerService.call(this, service, opt)
              .then(() => {
                deferred.resolve({});
              });
          })
          .catch(() => {
            return registerService.call(this, service, opt)
              .then(() => {
                deferred.resolve({});
              });
          });

        return deferred.promise;
      })(serviceName);
    });

    return q.all(promises);
  };
};

