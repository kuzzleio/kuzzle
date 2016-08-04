module.exports = function (params) {

  return unstringify({
    services: require('./services')(params),
    serviceSettingsCollection: params.serviceSettingsCollection,
    servicesDefaultInitTimeout: params.servicesDefaultInitTimeout,
    internalEngine: require('./models/internalEngine')(params),
    writeEngine: require('./models/writeEngine')(params),
    readEngine: require('./models/readEngine')(params),
    internalBroker: params.internalBroker,
    proxyBroker: params.proxyBroker,
    hooks: require('./hooks'),
    queues: require('./queues'),
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
  });
};

/**
 * RC params can be overriden using some environment variables,
 * in which case all values are passed as strings.
 * 
 * When dealing with configuration, we can safely assume the expected 
 * correct type
 * 
 * @param cfg
 */
function unstringify (cfg) {
  Object.keys(cfg).forEach(k => {
    // exception - *version entries need to be kept as string
    if (/version$/i.test(k)) {
      return;
    }
    
    if (typeof cfg[k] === 'string') {
      if (cfg[k] === 'true') {
        cfg[k] = true;
      }
      else if (cfg[k] === 'false') {
        cfg[k] = false;
      }
      else if (/^[0-9]+$/.test(cfg[k])) {
        cfg[k] = parseInt(cfg[k]);
      }
      else if (/^[0-9\.]+$/.test(cfg[k])) {
        cfg[k] = parseFloat(cfg[k]);
      }
    }
    else if (cfg[k] instanceof Object) {
      cfg[k] = unstringify(cfg[k]);
    }
  });
  
  return cfg;
}
