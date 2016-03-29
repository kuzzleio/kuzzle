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
    enableServices: 'enableServices',
    cleanAndPrepare: 'cleanAndPrepare',
    statsCache: 'redis',
    tokenCache: 'redis'
  };
};
