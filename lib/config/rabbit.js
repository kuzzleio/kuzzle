module.exports = function (params) {

  var config = {};

  if (process.env.MQ_BROKER_HOST && process.env.MQ_BROKER_PORT) {
    return {
      host: process.env.MQ_BROKER_HOST,
      port: process.env.MQ_BROKER_PORT,
      enabled: true
    };
  }

  if (params.mqBroker.enabled !== undefined) {
    config.enabled = params.mqBroker.enabled;
  }
  else {
    config.enabled = false;
  }

  config.host = params.mqBroker.host || 'localhost';
  config.port = params.mqBroker.port || 5672;

  return config;
};