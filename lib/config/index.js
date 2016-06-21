module.exports = function (params) {
  return {
    default: params.default,
    services: require('./services')(params),
    serviceSettingsCollection: params.serviceSettingsCollection,
    internalEngine: require('./models/internalEngine')(params),
    writeEngine: require('./models/writeEngine')(params),
    readEngine: require('./models/readEngine')(params),
    loggerEngine: require('./models/logEngine'),
    internalBroker: params.internalBroker,
    proxyBroker: params.proxyBroker,
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
    httpRoutes: require('./httpRoutes'),
    cluster: params.cluster,
    httpPort: params.httpPort
  };
};
