var
  Http = require('./http'),
  KuzzleProxy = require('./kuzzleProxy'),
  Mq = require('./mq');

/**
 * @param {Kuzzle} kuzzle
 * @param {Params} params
 * @constructor
 */
function EntryPoints (kuzzle, params) {
  this.proxy = new KuzzleProxy(kuzzle, params);
  this.http = new Http(kuzzle, params);
  this.mq = new Mq(kuzzle, params);
}

EntryPoints.prototype.init = function () {
  this.proxy.init();
  this.http.init();
  this.mq.init();
};

module.exports = EntryPoints;