var
  // Basic methods that DSL will curry for build complex custom filters
  methods = require('./methods'),
  async = require('async'),
  _ = require('lodash'),
  q = require('q');


module.exports = function Dsl (kuzzle) {

  this.curriedFunctions = {

  };

  /**
   * Get a filters object, parse it, create curried function and return
   * a mapping between field and function
   *
   * @param filters something like:
   *
   * filters = {
   *  term: { 'subject': 'kuzzle' }
   *  range: { 'star': { 'gte': 3 } }
   * }
   *
   * @return an object with the mapping field and curried functions to apply on this field:
   *
   * {
   *  subject: { 'termSubjectKuzzle' : [] },
   *  star: { 'rangeStarGte3' : [] }
   * }
   */
  this.filtersTransformer = function (filters) {
    var
      deferred = q.defer(),
      formattedFilters;

    async.each(Object.keys(filters), function (fn, callback) {

      if (!methods[fn]) {
        callback('Function ' + fn + ' is undefined');
        return false;
      }

      var field = Object.keys(filters[fn])[0];
      this.createCurriedFunction(fn, field, filters[fn][field]);

      callback();

    }.bind(this), function (err) {
      if (err) {
        deferred.reject(err);
        return false;
      }

      deferred.resolve(formattedFilters);
    }.bind(this));

    return deferred.promise;
  };

  this.createCurriedFunction = function (fn, field, value) {

  };

};