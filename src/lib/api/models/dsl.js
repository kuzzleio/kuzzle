var
  // Basic methods that DSL will curry for build complex custom filters
  methods = require('./methods'),
  async = require('async'),
  _ = require('lodash'),
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
        curriedName = filters[fn][field];

      if (_.isArray(curriedName)) {
        curriedName = _.sortBy(_.flattenDeep(curriedName));
      }

      if (_.isObject(curriedName)) {

      }

      curriedName = fn+field+curriedName.toString();

      filtersNames[curriedName] = {};
      filtersNames[curriedName][fn] = filters[fn];

      callback();
    }, function () {
      deferred.resolve(filtersNames);
    });

    return deferred.promise;
  };

  this.createCurriedFunction = function (name, filter) {
    var
      fn = Object.keys(filter)[0],
      field = Object.keys(filter[fn])[0],
      value = filter[fn][field];

    curried = _.curry(methods[fn]);
    return _.curry(curried(value));
  };

};