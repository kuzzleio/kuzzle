var
  _ = require('lodash'),
  async = require('async'),
  ClusterNode = require('./clusterNode'),
  q = require('q'),
  util = require('util'),
  WS = require('ws');

function ClusterMasterNode (clusterManager) {
  this.kuzzle = clusterManager.kuzzle;
  this.clusterManager = clusterManager;
  this.server = null;
  this.nodes = [];

  this.init = () => {
    var deferred = q.defer();

    this.nodes.push(this.uuid());


    /**
     * @param msg { event: 'event', data: {...} }
     */
    this.router.socket.on('message', onRouter.bind(this));

    async.parallel([
      // @todo: make bindings configurable
      cb => this.router.socket.bind('tcp://*:7599', cb),
      cb => this.publisher.bind('tcp://*:7598', cb),
      cb => this.collector.bind('tcp://*:7597', cb)
    ], (err) => {
      if (err) {
        return deferred.reject(err);
      }

      this.heartBeat();

      return deferred.resolve();
    });

    return deferred.promise;
  };

}

util.inherits(ClusterMasterNode, ClusterNode);

ClusterMasterNode.prototype.outSocket = function () {
  return this.publisher;
};

ClusterMasterNode.prototype.heartBeat = function () {
  if (this._hearBeatTimer) {
    return;
  }

  // @todo: make heartbeat interval configurable
  this._heartBeatTimer = setInterval(() => {
    this.publisher.send('{"event": "heartBeat"}');
  }, this.kuzzle.config.cluster.heartBeatInterval);
};


module.exports = ClusterMasterNode;

/**
 *
 * @param msg serialized data received from subscriber { event: 'event', data: {..} }
 */
function onRouter () {
  var
    args = Array.prototype.slice.call(arguments),
    identity = args[0].toString(),
    request = JSON.parse(args[1].toString()),
    event;

  event = 'on' + request.event.charAt(0).toUpperCase() + request.event.slice(1);

  if (typeof this.router[event] === 'function') {
    return this.router[event](identity, request.data);
  }
}



