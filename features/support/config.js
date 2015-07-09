module.exports = {
  url: process.env.KUZZLE_URL || 'http://localhost:8081',
  mqttUrl: process.env.KUZZLE_MQTT_URL || 'mqtt://rabbit:1883'
};
