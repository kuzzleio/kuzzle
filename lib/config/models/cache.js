module.exports = function (params) {

  var cache = {
    nodes: null,
    node: null,
    cluster: false
  };

  if (process.env.CACHE_HOST && process.env.CACHE_PORT) {
    cache.node = {
      host: process.env.CACHE_HOST,
      port: process.env.CACHE_PORT
    };
  }
  else if (params.cache) {
    if (params.cache.nodes) {
      cache.nodes = params.cache.nodes;
    }
    else if (params.cache) {
      cache.node = params.cache.node;
    }
  }

  cache.databases = ['notificationCache', 'statsCache', 'userCache', 'internalCache', 'tokenCache', 'memoryStorage'];

  return cache;
};
