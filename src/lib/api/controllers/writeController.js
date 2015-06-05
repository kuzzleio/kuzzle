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
      // use uuid v1 http://blog.mikemccandless.com/2014/05/choosing-fast-unique-identifier-uuid.html
      data.content._id = uuid.v1();
    }

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

  this.update = function (data) {
    var deferred = q.defer();

    // TODO: add validation logic -> object is valid ? + schema is valid ?

    kuzzle.emit('data:update', data);

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

  this.delete = function (data) {
    var deferred = q.defer();

    // TODO: add validation logic -> object is valid ? + schema is valid ?

    kuzzle.emit('data:delete', data);

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