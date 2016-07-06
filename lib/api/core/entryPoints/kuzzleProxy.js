var
  RequestObject = require('kuzzle-common-objects').Models.requestObject;

/**
 * Manage communication with the load balancer
 *
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function KuzzleProxy (kuzzle) {
  this.kuzzle = kuzzle;
  this.channels = {};
  this.isDummy = false;
}

KuzzleProxy.prototype.init = function () {
  this.kuzzle.services.list.proxyBroker.listen('request', onRequest.bind(this));
  this.kuzzle.services.list.proxyBroker.listen('connection', onConnection.bind(this));
  this.kuzzle.services.list.proxyBroker.listen('disconnect', onDisconnect.bind(this));
  this.kuzzle.services.list.proxyBroker.listen('error', onDisconnect.bind(this));
};

KuzzleProxy.prototype.joinChannel = function (data) {
  this.kuzzle.services.list.proxyBroker.send('joinChannel', data);
};

KuzzleProxy.prototype.leaveChannel = function (data) {
  this.kuzzle.services.list.proxyBroker.send('leaveChannel', data);
};

KuzzleProxy.prototype.notify = function (data) {
  if (this.isDummy) {
    return false;
  }

  this.kuzzle.services.list.proxyBroker.send('notify', data);
};

KuzzleProxy.prototype.broadcast = function (data) {
  if (this.isDummy) {
    return false;
  }

  this.kuzzle.services.list.proxyBroker.send('broadcast', data);
};

/**
 * @this {Lb}
 * @param data
 */
function onRequest (data) {
  var requestObject;

  if (data.request && data.context && data.context.connection && data.context.connection.type) {
    requestObject = new RequestObject(data.request, data.request.data, data.context.connection.type);

    this.kuzzle.funnel.execute(requestObject, data.context, (error, responseObject) => {
      this.kuzzle.services.list.proxyBroker.send('response', {
        requestId: responseObject.requestId,
        response: responseObject.toJson(),
        connection: data.context.connection
      });
    });
  }
}

/**
 * @this {Lb}
 * @param data
 */
function onConnection (data) {
  if (data.context && data.context.connection && data.context.connection.type && data.context.connection.id) {
    this.kuzzle.router.newConnection(data.context.connection.type, data.context.connection.id);
  }
}

/**
 * @this {Lb}
 * @param data
 */
function onDisconnect (data) {
  if (data.context) {
    this.kuzzle.router.removeConnection(data.context);
  }
}

module.exports = KuzzleProxy;
