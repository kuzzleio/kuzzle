var
  WSClient = require('./wsBrokerClient'),
  WSServer = require('./wsBrokerServer');

module.exports = function (brokerType, onlyClient, notifyOnListen) {
  return function (kuzzle, opts) {
    if (!kuzzle.config[brokerType]) {
      throw new Error(`No configuration found for broker ${brokerType}. Are you sure this broker exists?`);
    }
    
    return (opts.isServer && onlyClient === undefined)
      ? new WSServer(brokerType, kuzzle.config[brokerType], kuzzle.pluginsManager)
      : new WSClient(brokerType, kuzzle.config[brokerType], kuzzle.pluginsManager, notifyOnListen); 
  };
};

