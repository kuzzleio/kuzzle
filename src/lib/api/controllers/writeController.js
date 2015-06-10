var
  // For create the unique id of the object that the user send
  uuid = require('node-uuid'),
  _ = require('lodash'),
  async = require('async'),
  q = require('q');

module.exports = function WriteController (kuzzle) {

  this.create = function (data) {
    var deferred = q.defer();

    if (data.body === undefined || _.isEmpty(data.body)) {
      deferred.reject('The body can\'t be empty for create action');
      return deferred.promise;
    }

    // TODO: add validation logic -> object is valid ? + schema is valid ?
    if (data.persist !== false && data.id === undefined) {
      // use uuid v1 http://blog.mikemccandless.com/2014/05/choosing-fast-unique-identifier-uuid.html
      data.id = uuid.v1();
    }

    kuzzle.emit('data:create', data);

    // Test saved filters for notify rooms in a next step
    kuzzle.dsl.testFilters(data)
      .then(function (rooms) {
        deferred.resolve({data: data, rooms: rooms});
      })
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
  };

  this.update = function (data) {
    var deferred = q.defer();

    if (data.body === undefined || _.isEmpty(data.body)) {
      deferred.reject('Body can\'t be empty for create action');
      return deferred.promise;
    }

    // TODO: add validation logic -> object is valid ? + schema is valid ?

    kuzzle.emit('data:update', data);

    deferred.resolve({data: {}});
    return deferred.promise;
  };

  this.delete = function (data) {
    var deferred = q.defer();

    // TODO: add validation logic -> object is valid ? + schema is valid ?

    kuzzle.emit('data:delete', data);

    deferred.resolve({data: {}});
    return deferred.promise;
  };

  this.deleteByQuery = function (data) {
    var deferred = q.defer();

    // TODO: add validation logic -> object is valid ? + schema is valid ?

    kuzzle.emit('data:deleteByQuery', data);

    deferred.resolve({data: {}});
    return deferred.promise;
  };

  this.deleteCollection = function (data) {
    var deferred = q.defer();

    // TODO: add validation logic -> object is valid ? + schema is valid ?

    kuzzle.emit('data:deleteCollection', data);

    deferred.resolve({data: {}});
    return deferred.promise;
  };

};