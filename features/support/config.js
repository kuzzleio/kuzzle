module.exports = {
  url: process.env.KUZZLE_URL || 'http://localhost:8081',
  mqttHost: process.env.KUZZLE_MQTT_HOST || 'rabbit',
  mqttPort: process.env.KUZZLE_MQTT_PORT || '1883'
};
