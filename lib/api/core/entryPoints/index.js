
var
  Http = require('./http'),
  Lb = require('./lb'),
  Mq = require('./mq');

module.exports = function entryPoints (kuzzle, params) {
  return {
    lb: new Lb(kuzzle, params),
    http: new Http(kuzzle, params),
    mq: new Mq(kuzzle, params)
  };
};