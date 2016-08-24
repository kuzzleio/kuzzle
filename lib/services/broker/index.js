var
  WSClient = require('./wsBrokerClient'),
  WSServer = require('./wsBrokerServer');

module.exports = function (brokerType, client, notifyOnListen) {
  return function (kuzzle, opts, config) {

    if (opts && opts.client !== undefined) {
      client = opts.client;
    }

    if (!config) {
      throw new Error(`No configuration found for broker ${brokerType}. Are you sure this broker exists?`);
    }
    
    return client
      ? new WSClient(brokerType, config, kuzzle.pluginsManager, notifyOnListen)
      : new WSServer(brokerType, config, kuzzle.pluginsManager);
  };
};

