var
  q = require('q');

module.exports = function WriteController (kuzzle) {

  this.import = function (data) {
    var deferred = q.defer();

    kuzzle.emit('data:bulkImport', data);

    deferred.resolve({data: {}});
    return deferred.promise;
  };

};