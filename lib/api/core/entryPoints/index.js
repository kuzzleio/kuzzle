var
  Http = require('./http'),
  Promise = require('bluebird'),
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
      return Promise.resolve();
    });
};

module.exports = EntryPoints;
