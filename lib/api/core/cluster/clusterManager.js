/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function ClusterManager (kuzzle) {

  this.kuzzle = kuzzle;

  this.init = function() {
    // We send to the Proxy this Kuzzle HTTP port configuration
    kuzzle.services.list.proxyBroker.send('httpPortInitialization', {httpPort: kuzzle.config.httpPort});
  }
}

module.exports = ClusterManager;
