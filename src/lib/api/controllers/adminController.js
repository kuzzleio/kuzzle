var
  q = require('q');

module.exports = function WriteController (kuzzle) {

  this.deleteCollection = function (data) {
    var deferred = q.defer();

    kuzzle.emit('data:deleteCollection', data);

    deferred.resolve({data: {}});
    return deferred.promise;
  };

  this.putMapping = function (data) {
    var deferred = q.defer();

    kuzzle.emit('data:putMapping', data);

    deferred.resolve({data: {}});
    return deferred.promise;
  };

  this.getMapping = function (data) {
    return kuzzle.services.list.readEngine.getMapping(data);
  };

};