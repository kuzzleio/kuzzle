
var
  Http = require('./http'),
  Lb = require('./lb'),
  Mq = require('./mq');

function EntryPoints (kuzzle, params) {
  this.lb = new Lb(kuzzle, params);
  this.http = new Http(kuzzle, params);
  this.mq = new Mq(kuzzle, params);
}

EntryPoints.prototype.init = function () {
  this.lb.init();
  this.http.init();
  this.mq.init();
};

module.exports = EntryPoints;