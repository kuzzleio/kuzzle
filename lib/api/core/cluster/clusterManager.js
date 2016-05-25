function ClusterManager (kuzzle) {

  this.kuzzle = kuzzle;

  kuzzle.services.list.lbBroker.on('open', () => {

    kuzzle.services.list.lbBroker.send(JSON.stringify({
      data: {
        httpPort: this.context.httpPort
      },
      webSocketId: null,
      room: 'httpPortInitialization'
    }));

    kuzzle.services.list.lbBroker.join('request', this.onRequest.bind(this));
    kuzzle.services.list.lbBroker.join('connection', this.onConnection.bind(this));
    kuzzle.services.list.lbBroker.join('disconnect', this.onDisconnect.bind(this));
    kuzzle.services.list.lbBroker.join('error', this.onDisconnect.bind(this));
  });
}

ClusterManager.prototype.onRequest = function (message) {
  this.kuzzle.funnel.execute(message.data, message.connection, (error, responseObject) => {
    this.kuzzle.services.list.lbBroker.send(JSON.stringify({
      requestId: responseObject.requestId,
      data: responseObject.toJson(),
      connection: message.connection,
      room: 'response'
    }));
    }
  );
};

ClusterManager.prototype.onConnection = function (message) {
  this.kuzzle.router.newConnection(message.connection.type, message.connection.id);
};

ClusterManager.prototype.onDisconnect = function (message) {
  this.kuzzle.router.removeConnection(message.connection);
};

module.exports = ClusterManager;