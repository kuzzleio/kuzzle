/**
 * Manage communication with the load balancer
 * @param kuzzle
 */
module.exports = function Lb (kuzzle) {
  this.kuzzle = kuzzle;
  this.channels = {};

  kuzzle.services.list.lbBroker.listen('request', onRequest.bind(kuzzle));
  kuzzle.services.list.lbBroker.listen('connection', onConnection.bind(kuzzle));
  kuzzle.services.list.lbBroker.listen('disconnect', onDisconnect.bind(kuzzle));
  kuzzle.services.list.lbBroker.listen('error', onDisconnect.bind(kuzzle));
};

Lb.prototype.joinChannel = (data) => {
  this.services.list.lbBroker.send('joinChannel', data);
};

Lb.prototype.leaveChannel = (data) => {
  this.services.list.lbBroker.send('leaveChannel', data);
};

Lb.prototype.notify = (data) => {
  if (this.isDummy) {
    return false;
  }

  this.kuzzle.services.list.lbBroker.send('notify', data);
};

Lb.prototype.broadcast = (data) => {
  if (this.isDummy) {
    return false;
  }

  this.kuzzle.services.list.lbBroker.send('broadcast', data);
};

function onRequest (message) {
  this.funnel.execute(message.data, message.connection, (error, responseObject) => {
      this.services.list.lbBroker.send('response', {
        requestId: responseObject.requestId,
        response: responseObject.toJson(),
        connection: message.connection
      });
    }
  );
}

function onConnection (message) {
  this.router.newConnection(message.connection.type, message.connection.id);
}

function onDisconnect (message) {
  this.router.removeConnection(message.connection);
}