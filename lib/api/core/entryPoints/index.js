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

EntryPoints.prototype.init = function entryPointsInit () {
  return this.http.init()
    .then(() => {
      this.proxy.init();
    });
};

module.exports = EntryPoints;
