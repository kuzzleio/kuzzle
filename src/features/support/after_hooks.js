var
  config = require('./config'),
  io = require('socket.io-client');

var afterHooks = function () {

  this.registerHandler('AfterFeatures', function (event, callback) {
    var socket = io(config.url, { forceNew: false});
    socket.close();
    callback();
  });

};


module.exports = afterHooks;