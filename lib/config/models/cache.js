module.exports = function (params) {
  return {
    host: process.env.CACHE_HOST || params.cache.host || 'localhost',
    port: process.env.CACHE_PORT || params.cache.port || 6379,
    databases: ['notificationCache', 'statsCache', 'userCache', 'internalCache', 'tokenCache', 'memoryStorage']
  };
};
