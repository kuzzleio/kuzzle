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

    kuzzle.emit('data:create', data);

    deferred.resolve();

    if (!data.persist) {
      // Test saved filters for notify rooms in a next step
      kuzzle.dsl.testFilters(data)
        .then(function (rooms) {
          this.kuzzle.notifier.notify(rooms, data);
        })
        .catch(function (error) {
          this.kuzzle.log.error(error);
        });
    }

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

    deferred.resolve();
    return deferred.promise;
  };

  this.delete = function (data) {
    var deferred = q.defer();

    // TODO: add validation logic -> object is valid ? + schema is valid ?

    kuzzle.emit('data:delete', data);

    deferred.resolve();
    return deferred.promise;
  };

  this.deleteByQuery = function (data) {
    var deferred = q.defer();

    // TODO: add validation logic -> object is valid ? + schema is valid ?

    kuzzle.emit('data:deleteByQuery', data);

    deferred.resolve();
    return deferred.promise;
  };

};