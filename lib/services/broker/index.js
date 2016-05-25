var
  q = require('q'),
  WSClient = require('./wsBrokerClient'),
  WSServer = require('./wsBrokerServer');

module.exports = function (brokerType, onlyClient) {

  function Broker (kuzzle, opts) {
    this.handler = (opts.isServer && !onlyClient)
      ? new WSServer(kuzzle)
      : new WSClient(kuzzle.config[brokerType], kuzzle.pluginsManager);
  }

  Broker.prototype.init = function () {
    return this.handler.init();
  };

  Broker.prototype.send = function (room, msg) {
    return this.handler.send(room, msg);
  };

  Broker.prototype.broadcast = function (room, msg) {
    return this.handler.broadcast(room, msg);
  };

  Broker.prototype.listen = function (room, cb) {
    return this.handler.listen(room, cb);
  };

  Broker.prototype.unsubscribe = function (room) {
    return this.handler.unsubscribe(room);
  };

  Broker.prototype.waitForClients = function (room) {
    if (this.handler instanceof WSClient) {
      return q();
    }

    return this.handler.waitForClients(room);
  };

  Broker.prototype.close = function () {
    return this.handler.close();
  };

  return Broker;
};
