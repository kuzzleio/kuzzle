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
    monitoring: 'newrelic',
    remoteActions: 'remoteActions',
    statsCache: 'redis',
    tokenCache: 'redis',
    queryCache: 'redis'
  };
};
