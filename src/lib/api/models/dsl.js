var
  // Basic methods that DSL will curry for build complex custom filters
  methods = require('./methods'),
  async = require('async'),
  _ = require('lodash'),
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

      name = JSON.stringify(name);
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

  this.createCurriedFunction = function (name, filter) {
    var
      fn = Object.keys(filter)[0],
      field = Object.keys(filter[fn])[0],
      value = filter[fn][field];

    curried = _.curry(methods[fn]);
    return _.curry(curried(value));
  };

};