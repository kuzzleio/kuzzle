var
  ClusterNode = require('./clusterNode'),
  q = require('q'),
  util = require('util'),
  uuid = require('node-uuid'),
  WS = require('ws');

function ClusterSlaveNode (clusterManager) {
  this.kuzzle = clusterManager.kuzzle;
  this.clusterManager = clusterManager;
  this.client = null;
  this.subscriber = null;
  this.nodes = [];
  this.master = null;

  this.options = {
    heartBeatTimeout: kuzzle.config.cluster.heartBeatTimeout,
    heartBeatInterval: kuzzle.config.cluster.heartBeatInterval
  };

  this.init = () => {
    this.client = zmq.socket('push');
    this.client.connect('tcp://localhost:7597');

    this.subscriber = zmq.socket('sub');
    this.subscriber.on('message', onSub.bind(kuzzle));

    this.subscriber.connect('tcp://localhost:7598');
    this.subscriber.subscribe('');

    return this.joinCluster()
      .then(clusterInfo => {
        setInterval(this.checkHeartBeat, this.options.heartBeatInterval);
        return q();
      });
  };
}

ClusterSlaveNode.prototype.joinCluster = function () {
  var
    deferred = q.defer(),
    dealer = zmq.socket('dealer');

  // nb: identity must be set *before* connecting
  dealer.identity = this.uuid();


  dealer.connect('tcp://localhost:7599');

  dealer.on('message', function(response) {
    response = JSON.parse(response);

    this.nodes = response.nodes;
    this.master = response.master;

    dealer.removeAllListeners();
    dealer.close();

    return deferred.resolve(response);
  });
  dealer.send(JSON.stringify({ event: 'clientJoin'}));

  return deferred.promise;
};

ClusterSlaveNode.prototype.outSocket = function () {
  return this.client;
};

ClusterSlaveNode.prototype.checkHeartBeat = function () {
  var delta = new Date().getTime() - this._lastHeartBeatTime;
  if (delta >= this.options.heartBeatTimeout) {
    this.masterIsDown();
  }
};

ClusterSlaveNode.prototype.masterIsDown = function () {
};

util.inherits(ClusterSlaveNode, ClusterNode);

module.exports = ClusterSlaveNode;


/**
 *
 * @param msg { event: 'event', data: {...} }
 */
function onSub(msg) {
  msg = JSON.parse(msg);

  switch (msg.event) {
    case 'heartBeat':
      this._lastHeartBeatTime = new Date().getTime();
      break;
    case 'subscriptionChange':
      return this.hotelClerk.onSubscriptionChange(msg.data);
      break;
  }

}
