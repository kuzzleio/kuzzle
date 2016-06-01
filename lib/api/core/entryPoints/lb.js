var RequestObject = require('kuzzle-common-objects').Models.requestObject;

/**
 * Manage communication with the load balancer
 * @param kuzzle
 */
function Lb (kuzzle) {
  this.kuzzle = kuzzle;
  this.channels = {};
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

function onRequest (data) {
  if (data.request && data.context && data.context.connection && data.context.connection.type) {
    var requestObject = new RequestObject(data.request, {}, data.context.connection.type);

    this.kuzzle.funnel.execute(requestObject, data.context, (error, responseObject) => {
        this.kuzzle.services.list.lbBroker.send('response', {
          requestId: responseObject.requestId,
          response: responseObject.toJson(),
          connection: data.context.connection
        });
      }
    );
  }
}

function onConnection (data) {
  if (data.context && data.context.connection && data.context.connection.type && data.context.connection.id) {
    this.kuzzle.router.newConnection(data.context.connection.type, data.context.connection.id);
  }
}

function onDisconnect (data) {
  if (data.context) {
    this.kuzzle.router.removeConnection(data.context);
  }
}

module.exports = Lb;