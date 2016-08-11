/**
 * This file allow to retrieve configuration easily.
 * You can change these url in .kuzzlerc file in root folder or you can define environment variable like KUZZLE_URL, KUZZLE_MQTT_URL, KUZZLE_AMQP_URL, KUZZLE_STOMP_URL
 */

/** @type {Params} */
var config = require('../../lib/config');

/**
 * @returns {{url: string, ws: string}}
 */
module.exports = function () {

  var defaultUrls = {
    url: 'http://api:7511',
    ws: 'http://api:7512'
  };

  if (process.env.KUZZLE_URL) {
    defaultUrls.url = process.env.KUZZLE_URL;
  }
  if (process.env.KUZZLE_WS_URL) {
    defaultUrls.url = process.env.KUZZLE_WS_URL;
  }

  if (config.port) {
    defaultUrls.url = 'http://api:' + config.port;
  }

  return defaultUrls;
};
