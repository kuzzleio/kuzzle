module.exports = function (params) {

  return {
    services: require('./services')(params),
    writeEngine: require('./models/writeEngine')(params),
    readEngine: require('./models/readEngine')(params),
    loggerEngine: require('./models/logEngine'),
    broker: require('./models/internalbroker')(params),
    mqBroker: require('./models/rabbit')(params),
    hooks: require('./hooks'),
    queues: require('./queues'),
    workers: require('./workers'),
    notificationCache: require('./models/notificationCache')(params)
  };
};
