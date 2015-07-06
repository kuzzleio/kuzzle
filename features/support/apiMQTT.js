var
  config = require('./config'),
  mqtt = require('mqtt');

module.exports = {
  world: null,
  mqttClient: null,

  init: function (world) {
    this.world = world;
    this.mqttClient = mqtt.connect('mqtt://' + config.host + ':' + config.port);
  }
};