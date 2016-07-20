module.exports = function () {
  return {
    broker: 'internalbroker',
    proxyBroker: 'proxyBroker',
    writeEngine: 'elasticsearch',
    readEngine: 'elasticsearch',
    notificationCache: 'redis',
    userCache: 'redis',
    internalCache: 'redis',
    // redis index exposed to the end user by the memory storage controller
    memoryStorage: 'redis',
    statsCache: 'redis',
    tokenCache: 'redis'
  };
};
