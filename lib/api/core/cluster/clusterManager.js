function ClusterManager (kuzzle) {

  this.kuzzle = kuzzle;

  this.init = function() {
    // We send to the LB this Kuzzle HTTP port configuration
    kuzzle.services.list.proxyBroker.send('httpPortInitialization', {httpPort: kuzzle.config.httpPort});
  }
}

module.exports = ClusterManager;
