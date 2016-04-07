module.exports = function () {
  return {
    broker: 'internalbroker',
    mqBroker: 'rabbit',
    writeEngine: 'elasticsearch',
    readEngine: 'elasticsearch',
    perf: 'logstash',
    notificationCache: 'redis',
    userCache: 'redis',
    internalCache: 'redis',
    // rediis index exposed to the end user by the memory storage controller
    memoryStorage: 'redis',
    monitoring: 'newrelic',
    statsCache: 'redis',
    tokenCache: 'redis'
  };
};
