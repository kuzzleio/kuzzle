function ClusterManager (kuzzle) {

  this.kuzzle = kuzzle;

  // We send to the LB this Kuzzle HTTP port configuration
  kuzzle.services.list.lbBroker.send('httpPortInitialization', {httpPort: kuzzle.config.httpPort});
}

ClusterManager.prototype.broadcast = function (data) {
  console.log('CLUSTER-SEND', data);
};

module.exports = ClusterManager;
