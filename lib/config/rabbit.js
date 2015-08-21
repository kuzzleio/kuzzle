module.exports = function (params) {

  if (process.env.MQ_BROKER_HOST && process.env.MQ_BROKER_PORT) {
    return {
      host: process.env.MQ_BROKER_HOST,
      port: process.env.MQ_BROKER_PORT
    };
  }

  return {
    host: params.mqBroker.host || 'localhost',
    port: params.mqBroker.port || 5672
  };

};