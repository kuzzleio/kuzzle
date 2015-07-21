module.exports = {
  url: process.env.KUZZLE_URL || 'http://localhost:7512',
  mqttUrl: process.env.KUZZLE_MQTT_URL || 'mqtt://localhost:1883',
  amqpUrl: process.env.KUZZLE_AMQP_URL || 'amqp://localhost:5672',
  stompUrl: process.env.KUZZLE_STOMP_URL || 'stomp://localhost:61613'
};
