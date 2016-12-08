var
  WSBrokerClient = require('./wsBrokerClient'),
  WSBrokerServer = require('./wsBrokerServer');

/**
 * @param {string} brokerType
 * @param {boolean} client
 * @param {boolean} notifyOnListen
 * @returns {WSBrokerClient|WSBrokerServer}
 */
module.exports = function Broker (brokerType, client, notifyOnListen) {
  return function brokerInit (kuzzle, opts, config) {

    if (opts && opts.client !== undefined) {
      client = opts.client;
    }

    if (!config) {
      throw new Error(`No configuration found for broker ${brokerType}. Are you sure this broker exists?`);
    }
    
    return client
      ? new WSBrokerClient(brokerType, config, kuzzle.pluginsManager, notifyOnListen)
      : new WSBrokerServer(brokerType, config, kuzzle.pluginsManager);
  };
};

