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
      server = false,
      services = this.kuzzle.config.services;

    if (options) {
      if (options.blacklist) {
        blacklist = options.blacklist;
      }

      server = options.server || false;
    }

    Object.keys(services).forEach(function (serviceName) {
      var opt = { service: serviceName, isServer: server };

      this.list[serviceName] = new (require('./' + services[serviceName]))(kuzzle, opt);

      if (blacklist.indexOf(serviceName) === -1) {
        this.list[serviceName].init();
      }
    }.bind(this));
  };
};
