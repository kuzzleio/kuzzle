module.exports = function (params) {

  return {
    services: require('./services')(params),
    serviceSettingsCollection: params.serviceSettingsCollection,
    internalEngine: require('./models/internalEngine')(params),
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
    defaultUserProfiles: params.userProfiles,
    defaultUserRoles: params.userRoles,
    repositories: params.repositories,
    pluginsManager: params.pluginsManager,
    internalIndex: params.internalIndex,
    request: params.request,
    cluster: params.cluster,
    httpPort: params.httpPort
  };
};
