var
  WSClient = require('./wsBrokerClient'),
  WSServer = require('./wsBrokerServer');

module.exports = function (brokerType, client, notifyOnListen) {
  return function (kuzzle, opts) {
    if (opts && opts.client !== undefined) {
      client = opts.client;
    }

    if (!kuzzle.config[brokerType]) {
      throw new Error(`No configuration found for broker ${brokerType}. Are you sure this broker exists?`);
    }
    
    return client
      ? new WSClient(brokerType, kuzzle.config[brokerType], kuzzle.pluginsManager, notifyOnListen)
      : new WSServer(brokerType, kuzzle.config[brokerType], kuzzle.pluginsManager);
  };
};

