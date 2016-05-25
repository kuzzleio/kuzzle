
var
  http = require('./http'),
  lb = require('./lb'),
  mq = require('./mq');

module.exports = {
  initAll: function (kuzzle, params) {
    lb.init(kuzzle, params);
    http.init(kuzzle, params);
    mq.init(kuzzle);
  }
};