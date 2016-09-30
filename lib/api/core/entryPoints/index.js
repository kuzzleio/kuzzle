var
  Http = require('./http'),
  KuzzleProxy = require('./kuzzleProxy');

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function EntryPoints (kuzzle) {
  this.proxy = new KuzzleProxy(kuzzle);
  this.http = new Http(kuzzle);
}

EntryPoints.prototype.init = function () {
  this.proxy.init();
  this.http.init();
};

module.exports = EntryPoints;
