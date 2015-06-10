var
  q = require('q');

module.exports = function WriteController (kuzzle) {

  this.deleteCollection = function (data) {
    var deferred = q.defer();

    kuzzle.emit('data:deleteCollection', data);

    deferred.resolve({data: {}});
    return deferred.promise;
  };

};