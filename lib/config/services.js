module.exports = function () {
  return {
    broker: 'internalbroker',
    mqBroker: 'rabbit',
    writeEngine: 'elasticsearch',
    readEngine: 'elasticsearch',
    perf: 'logstash',
    notificationCache: 'redis',
    monitoring: 'newrelic',
    remoteActions: 'remoteActions',
    sessionCache: 'redis'
  };
};
