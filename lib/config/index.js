module.exports = function (params) {

  return {
    writeEngine: require('./models/writeEngine')(params),
    readEngine: require('./models/readEngine')(params),
    loggerEngine: require('./models/logEngine'),
    broker: require('./internalbroker')(params),
    mqBroker: require('./rabbit')(params),
    hooks: require('./hooks'),
    queues: require('./queues'),
    workers: require('./workers'),
    notificationCache: require('./models/notificationCache')(params)
  };
};