/**
 * This file allow to retrieve configuration easily.
 * You can change these url in .kuzzlerc file in root folder or you can define environment variable like KUZZLE_URL, KUZZLE_MQTT_URL, KUZZLE_AMQP_URL, KUZZLE_STOMP_URL
 */

var config = require('rc')('kuzzle');

module.exports = function () {

  var defaultUrls = {
    url: 'http://localhost:7512',
    mqttUrl: 'mqtt://localhost:1883',
    amqpUrl: 'amqp://localhost:5672',
    stompUrl: 'stomp://localhost:61613'
  };

  if (process.env.KUZZLE_URL) {
    defaultUrls.url = process.env.KUZZLE_URL;
  }
  if (process.env.KUZZLE_MQTT_URL) {
    defaultUrls.mqttUrl = process.env.KUZZLE_MQTT_URL;
  }
  if (process.env.KUZZLE_AMQP_URL) {
    defaultUrls.amqpUrl = process.env.KUZZLE_AMQP_URL;
  }
  if (process.env.KUZZLE_STOMP_URL) {
    defaultUrls.stompUrl = process.env.KUZZLE_STOMP_URL;
  }

  if (config.port) {
    defaultUrls.url = 'http://localhost:' + config.port;
  }

  if (config.mqBroker) {
    defaultUrls.mqttUrl = 'mqtt://' + config.mqBroker.host + ':1883';
    defaultUrls.amqpUrl = 'amqp://' + config.mqBroker.host + ':5672';
    defaultUrls.stompUrl = 'stomp://' + config.mqBroker.host + ':61613';
  }

  return defaultUrls;
};
