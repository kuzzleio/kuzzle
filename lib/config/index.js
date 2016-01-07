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
    cache: require('./models/cache')(params),
    stats: require('./stats'),
    jsonWebToken: require('./models/jsonWebToken')(params),
    passwordManager: params.passwordManager,
    defaultUserProfiles: params.userProfiles,
    defaultUserRoles: params.userRoles,
    repositories: params.repositories,
    pluginsManager: params.pluginsManager
  };
};
