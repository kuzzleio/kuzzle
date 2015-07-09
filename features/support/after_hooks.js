var
  config = require('./config'),
  io = require('socket.io-client');

var afterHooks = function () {
  var world;

  /*
  Workaround to a Cucumber.js bug, where 'this' is not 'world'.
  Issue marked as "won't be fixed".
  Issue link: https://github.com/cucumber/cucumber-js/issues/165
   */
  this.After(function (callback) {
    world = this;
    callback();
  });

  this.registerHandler('AfterFeatures', function (event, callback) {
    var socket = io(config.url, { forceNew: false});
    socket.destroy();

    world.apiTypes.mqtt.disconnect();

    callback();
  });

};


module.exports = afterHooks;