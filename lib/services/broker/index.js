var
  InternalError = require('kuzzle-common-objects').Errors.internalError,
  q = require('q'),
  WSClient = require('./wsBrokerClient'),
  WSServer = require('./wsBrokerServer'),
  _kuzzle;

function Broker (kuzzle, opts) {
  _kuzzle = kuzzle;
  this.handler = opts.isServer
    ? new WSServer(kuzzle)
    : new WSClient(kuzzle.config.broker, kuzzle.pluginsManager);
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
    _kuzzle.pluginsManager.trigger('log:error', 'Called waitForClients on a client instance');
    return q.reject(new InternalError('Called waitForClients on a client instance'));
  }

  return this.handler.waitForClients(room);
};

Broker.prototype.close = function () {
  return this.handler.close();
};

module.exports = Broker;
