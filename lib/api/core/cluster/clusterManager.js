function ClusterManager (kuzzle) {

  this.kuzzle = kuzzle;

  // We send to the LB this Kuzzle HTTP port configuration
  kuzzle.services.list.lbBroker.send('httpPortInitialization', {httpPort: kuzzle.config.httpPort});
}

module.exports = ClusterManager;