var
  RequestObject = require('kuzzle-common-objects').Models.requestObject;

/**
 * Manage communication with the load balancer
 *
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function Lb (kuzzle) {
  this.kuzzle = kuzzle;
  this.channels = {};
  this.isDummy = false;
}

Lb.prototype.init = function () {
  this.kuzzle.services.list.lbBroker.listen('request', onRequest.bind(this));
  this.kuzzle.services.list.lbBroker.listen('connection', onConnection.bind(this));
  this.kuzzle.services.list.lbBroker.listen('disconnect', onDisconnect.bind(this));
  this.kuzzle.services.list.lbBroker.listen('error', onDisconnect.bind(this));
};

Lb.prototype.joinChannel = function (data) {
  this.kuzzle.services.list.lbBroker.send('joinChannel', data);
};

Lb.prototype.leaveChannel = function (data) {
  this.kuzzle.services.list.lbBroker.send('leaveChannel', data);
};

Lb.prototype.notify = function (data) {
  if (this.isDummy) {
    return false;
  }

  this.kuzzle.services.list.lbBroker.send('notify', data);
};

Lb.prototype.broadcast = function (data) {
  if (this.isDummy) {
    return false;
  }

  this.kuzzle.services.list.lbBroker.send('broadcast', data);
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
      this.kuzzle.services.list.lbBroker.send('response', {
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

module.exports = Lb;