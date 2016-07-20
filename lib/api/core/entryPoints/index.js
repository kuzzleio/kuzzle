var
  Http = require('./http'),
  KuzzleProxy = require('./kuzzleProxy');

/**
 * @param {Kuzzle} kuzzle
 * @param {Params} params
 * @constructor
 */
function EntryPoints (kuzzle, params) {
  this.proxy = new KuzzleProxy(kuzzle, params);
  this.http = new Http(kuzzle, params);
}

EntryPoints.prototype.init = function () {
  this.proxy.init();
  this.http.init();
};

module.exports = EntryPoints;