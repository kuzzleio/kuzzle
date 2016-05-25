function ClusterManager (kuzzle) {

  this.kuzzle = kuzzle;

  // When the lb broker connection is open, we send to the LB this Kuzzle HTTP port configuration
  kuzzle.services.list.lbBroker.on('open', () => {
    kuzzle.services.list.lbBroker.send(JSON.stringify({
      data: {
        httpPort: this.context.httpPort
      },
      webSocketId: null,
      room: 'httpPortInitialization'
    }));
  });
}

module.exports = ClusterManager;