var
  q = require('q'),
  ClusterMasterNode = require('./clusterMasterNode'),
  ClusterSlaveNode = require('./clusterSlaveNode');

/**
 * The ClusterManager is a kuzzle property.
 * It is responsible of the cluster consistency
 *
 * @param kuzzle
 * @constructor
 */
function ClusterManager (kuzzle) {
  this.kuzzle = kuzzle;
}

ClusterManager.prototype.init = function () {
  this.node = this.kuzzle.config.isMaster
    ? new ClusterMasterNode(this)
    : new ClusterSlaveNode(this);

  return this.node.init();
};

module.exports = ClusterManager;
