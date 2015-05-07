var
  // Basic methods that DSL will curry for build complex custom filters
  methods = require('./methods'),
  async = require('async'),
  _ = require('lodash'),
  stringify = require('json-stable-stringify'),
  crypto = require('crypto'),
  q = require('q');


module.exports = function Dsl (kuzzle) {

  /**
   * Allow to send a collection and a list of filter and return all "curried" names for each filters
   *
   * @param {String} collection
   * @param {Object} filters
   * @returns {Promise} promise
   */
  this.getFunctionsNames = function (collection, filters) {
    var
      deferred = q.defer(),
      filtersNames = {};

    async.each(Object.keys(filters), function (fn, callback) {
      var
        field = Object.keys(filters[fn])[0],
        name = filters[fn][field];

      name = stringify(name);
      name = crypto.createHash('md5').update(name).digest('hex');
      name = fn+field+'-'+name;

      filtersNames[name] = {};
      filtersNames[name][fn] = filters[fn];

      callback();
    }, function () {
      deferred.resolve(filtersNames);
    });

    return deferred.promise;
  };

  /**
   * Create a curried function according to filter
   *
   * @param name
   * @param filter
   * @returns {String} a new curried function
   */
  this.createCurriedFunction = function (name, filter) {
    var
      fn = Object.keys(filter)[0],
      field = Object.keys(filter[fn])[0],
      value = filter[fn][field];

    var curried = _.curry(methods[fn]);
    return _.curry(curried(value));
  };


  /**
   * Test all filters in filtersTree for test which room to notify
   *
   * @param {Object} data
   * @returns {Promise} promise. Resolve a rooms list that we need to notify
   */
  this.testFilters = function (data) {
    var
      deferred = q.defer(),
      rooms = [];

    if (!data.collection) {
      deferred.reject('The data doesn\'t contain a collection');
      return deferred.promise;
    }

    // No filters set for this collection : we return an empty list
    if (!kuzzle.hotelClerk.filtersTree[data.collection]) {
      deferred.resolve(rooms);
      return deferred.promise;
    }

    async.each(Object.keys(data.content), function (field, callbackContent) {
      var fieldFilters = kuzzle.hotelClerk.filtersTree[data.collection][field];

      if (!fieldFilters) {
        callbackContent();
        return false;
      }

      async.each(Object.keys(fieldFilters), function (functionName, callbackField) {
        if (fieldFilters[functionName].fn(data.content[field])) {
          rooms = rooms.concat(fieldFilters[functionName].rooms);
        }

        callbackField();
      }, function () {
        callbackContent();
      });
    }, function () {
      deferred.resolve(rooms);
    });

    return deferred.promise;
  };

};