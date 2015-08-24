module.exports = function (params) {

  var config = {
    enabled: false
  };

  if (process.env.MQ_BROKER_HOST && process.env.MQ_BROKER_PORT) {
    return {
      host: process.env.MQ_BROKER_HOST,
      port: process.env.MQ_BROKER_PORT,
      enabled: true
    };
  }

  if (process.env.MQ_BROKER_ENABLED === 1) {
    config.enabled = true;
  }

  config.host = params.mqBroker.host || 'localhost';
  config.port = params.mqBroker.port || 5672;

  return config;
};