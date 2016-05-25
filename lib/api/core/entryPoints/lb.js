module.exports = {
  init: function (kuzzle) {
    kuzzle.services.list.lbBroker.join('request', onRequest.bind(kuzzle));
    kuzzle.services.list.lbBroker.join('connection', onConnection.bind(kuzzle));
    kuzzle.services.list.lbBroker.join('disconnect', onDisconnect.bind(kuzzle));
    kuzzle.services.list.lbBroker.join('error', onDisconnect.bind(kuzzle));
  }
};

function onRequest (message) {
  this.funnel.execute(message.data, message.connection, (error, responseObject) => {
      this.services.list.lbBroker.send(JSON.stringify({
        requestId: responseObject.requestId,
        data: responseObject.toJson(),
        connection: message.connection,
        room: 'response'
      }));
    }
  );
}

function onConnection (message) {
  this.router.newConnection(message.connection.type, message.connection.id);
}

function onDisconnect (message) {
  this.router.removeConnection(message.connection);
}