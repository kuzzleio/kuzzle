var
  _ = require('lodash'),
  async = require('async'),
  operators = require('./operators'),
  q = require('q');

module.exports = {

  /**
   * Build filtersTree according to a given filter for range filter and return the formatted filter
   * that can contains filters: gte, gt, lte, lt, from, to
   *
   * @param {Object} filtersTree pointer on object filtersTree defined in hotelClerkController
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @return {Promise} the formatted filter that need to be added to the room
   */
  range: function (filtersTree, roomId, collection, filter) {

    var
      deferred = q.defer(),
      field,
      formattedFilters;

    if (_.isEmpty(filter)) {
      deferred.reject('A filter can\'t be empty');
      return deferred.promise;
    }

    field = Object.keys(filter)[0];
    formattedFilters = {};

    async.each(Object.keys(filter[field]), function (fnAndValue, callback) {
      var
        fn = Object.keys(fnAndValue)[0],
        value = fnAndValue[fn],
        curriedFunctionName = 'range' + field + fn + value;

      var result = buildCurriedFunction(filtersTree, 'range', collection, field, curriedFunctionName, roomId);
      if (result.error) {
        callback(result.error);
        return false;
      }

      formattedFilters[result.path] = result.filter;

      callback();
    }, function (error) {
      if (error) {
        deferred.reject(error);
      }

      deferred.resolve({and : formattedFilters});
    });

    return deferred.promise;
  },

  /**
   * Build rooms and filtersTree according to a given filter for term filter (test equality)
   *
   * @param {Object} filtersTree pointer on object filtersTree defined in hotelClerkController
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @return {Promise} the formatted filter that need to be added to the room
   */
  term: function (filtersTree, roomId, collection, filter) {
    var
      deferred = q.defer(),
      field = Object.keys(filter)[0],
      value = filter[field],
      formattedFilters = {},
      curriedFunctionName = 'term'+field+value;

    var result = buildCurriedFunction(filtersTree, collection, field, 'term', value, curriedFunctionName, roomId);
    if (result.error) {
      deferred.reject(result.error);
      return deferred.promise;
    }

    formattedFilters[result.path] = result.filter;

    deferred.resolve(formattedFilters);
    return deferred.promise;
  },



  /**
   * Returns true only if the value in field has at least one non-null value
   */
  exists: function () {

  },

  /**
   * Return true only if the point in field is in the bounding box
   */
  geoBoundingBox: function () {

  },

  /**
   * Return true only if the point in field is in a specific distance from a geo point
   */
  geoDistance: function () {

  },

  /**
   * Return true only if the point in field is in a range from a specific point
   */
  geoDistanceRange: function () {

  },

  /**
   * Return true only if the point in field is in a polygon of points
   */
  geoPolygon: function () {

  },

  /**
   * Return true only if the point in field is in the square
   */
  geoShape: function() {

  },

  /**
   * Return true only if the value in field pass the regexp test
   */
  regexp: function () {

  },

  /**
   * Return true only if the value in field match on any (configurable) of the provided terms
   */
  terms: function () {

  },

  /**
   * Return true only if values in document are valid according to object provided
   */
  bool: function (document, object) {

  },

  /**
   * Return true only if the the clause not appear in the matching documents.
   */
  must: function (document, filters) {

  },

  /**
   * Return true only if value in field not correspond to all filters/values provided
   */
  mustNot: function () {

  },

  /**
   * Return true only if the clause should appear in the matching document.
   * In a boolean query with no must clauses, one or more should clauses must match a document.
   * The minimum number of should clauses to match can be set using the minimum_should_match parameter.
   */
  should: function () {

  }

};



var buildCurriedFunction = function (filtersTree, collection, field, operatorName, value, curriedFunctionName, roomId) {
  if (!operators[operatorName]) {
    return {error: 'Operator ' + operatorName + 'doesn\'t exist'};
  }

  var
    curriedFunction,
    path = collection+'.'+field+'.'+curriedFunctionName;

  curriedFunction  = _.curry(operators[operatorName]);
  curriedFunction = _.curry(curriedFunction(value));

  if (!filtersTree[collection]) {
    filtersTree[collection] = {};
  }

  if (!filtersTree[collection][field]) {
    filtersTree[collection][field] = {};
  }

  if (!filtersTree[collection][field][curriedFunctionName]) {
    filtersTree[collection][field][curriedFunctionName] = {
      rooms: [],
      fn: curriedFunction
    };
  }

  filtersTree[collection][field][curriedFunctionName].rooms.push(roomId);

  return {
    path: path,
    filter: filtersTree[collection][field][curriedFunctionName]
  };
};