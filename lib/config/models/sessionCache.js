module.exports = function (params) {
  var config = {
    host: params.sessionCache.host || 'localhost',
    port: params.sessionCache.port || 6379
  };

  if (process.env.SESSION_CACHE_HOST && process.env.SESSION_CACHE_PORT) {
    config.host = process.env.SESSION_CACHE_HOST;
    config.port = process.env.SESSION_CACHE_PORT;
  }

  return config;
};
