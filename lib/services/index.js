module.exports = function (kuzzle) {
  this.list = {};
  this.kuzzle = kuzzle;

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
