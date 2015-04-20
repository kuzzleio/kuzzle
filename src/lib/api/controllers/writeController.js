var
  // For create the unique id of the object that the user send
  uuid = require('node-uuid'),
  async = require('async'),
  q = require('q');

module.exports = function WriteController (kuzzle) {

  this.create = function (data) {
    var deferred = q.defer();

    // TODO: add validation logic -> object is valid ? + schema is valid ?
    if (data.persist !== false) {
      data.content._id = uuid.v4();
    }

    // Emit the main event
    kuzzle.log.verbose('emit event request:http');
    kuzzle.emit('data:create', data);

    // Test saved filters for notify rooms in a next step
    kuzzle.dsl.testFilters(data)
      .then(function (rooms) {
        deferred.resolve({ data: data, rooms: rooms});
      })
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
  };

};