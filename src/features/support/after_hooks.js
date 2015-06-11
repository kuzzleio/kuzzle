var io = require('socket.io-client');

var afterHooks = function () {

  this.registerHandler('AfterFeatures', function (event, callback) {
    var socket = io('http://localhost:8081', { forceNew: false});
    socket.close();
    callback();
  });

};


module.exports = afterHooks;