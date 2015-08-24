module.exports = function (params) {

  if (process.env.NOTIFICATION_CACHE_HOST && process.env.NOTIFICATION_CACHE_PORT) {
    return {
      host: process.env.NOTIFICATION_CACHE_HOST,
      port: process.env.NOTIFICATION_CACHE_PORT
    };
  }

  return {
    host: params.notificationCache.host || 'localhost',
    port: params.notificationCache.port || 6379
  };
};