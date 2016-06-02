var
  q = require('q'),
  _kuzzle;

function ClusterManager (kuzzle) {
  _kuzzle = kuzzle;

  // We send to the LB this Kuzzle HTTP port configuration
  kuzzle.services.list.lbBroker.send('httpPortInitialization', {httpPort: kuzzle.config.httpPort});
}

ClusterManager.prototype.init = function () {
  return (() => {
    if (_kuzzle.cluster.mode === 'server') {
      this.broker = _kuzzle.services.list.internalBroker;
      return q();
    }

    this.broker = require('../../../services/broker')('cluster', true, true);
    return this.broker.init();
  })()
    .then(() => {
      var config = _kuzzle.config.cluster;

      this.broker.listen(config.clusterName, _kuzzle.hotelClerk.onClusterStateUpdate)
    });


};

ClusterManager.prototype.broadcast = function (data) {
  console.log('CLUSTER-SEND', data);
};

module.exports = ClusterManager;


