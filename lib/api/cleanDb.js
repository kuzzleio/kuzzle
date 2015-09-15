var q = require('q');

module.exports = function () {

  var deferred = q.defer();

  // is a reset has been asked and we are launching a server ?
  if (process.env.LIKE_A_VIRGIN !== '1' || !this.isServer) {
    deferred.resolve();
    return deferred.promise;
  }

  this.services.list.writeEngine.reset()
    .then(function(){
      this.log.info('Reset done: Kuzzle is now like a virgin, touched for the very first time !');

      deferred.resolve();
    }.bind(this))
    .catch(function(){
      this.log.error('Oops... something really bad happened during reset...');

      // We resolve the promise, because we don't want stop the start process just because reset didn't work.
      // (can fail if the database is pristine)
      deferred.resolve();
    }.bind(this));

  return deferred.promise;
};