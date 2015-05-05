var
  _ = require('lodash'),
  async = require('async'),
  operators = require('./operators'),
  q = require('q');

module.exports = {

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
      field,
      value,
      formattedFilters,
      curriedFunctionName;

    if (_.isEmpty(filter)) {
      deferred.reject('A filter can\'t be empty');
      return deferred.promise;
    }

    field = Object.keys(filter)[0];
    value = filter[field];
    formattedFilters = {};
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

    async.each(Object.keys(filter[field]), function (fn, callback) {
      var
        value = filter[field][fn],
        curriedFunctionName = 'range' + field + fn + value;

      var result = buildCurriedFunction(filtersTree, collection, field, fn, value, curriedFunctionName, roomId);
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
   * Build rooms and filtersTree according to a given filter for bool filter (nested filters with ~and/or)
   *
   * @param {Object} filtersTree pointer on object filtersTree defined in hotelClerkController
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @return {Promise} the formatted filter that need to be added to the room
   */
  bool: function (filtersTree, roomId, collection, filter) {
    var
      deferred = q.defer(),
      formattedFilters;

    if (_.isEmpty(filter)) {
      deferred.reject('A filter can\'t be empty');
      return deferred.promise;
    }

    formattedFilters = {};

    async.each(Object.keys(filter), function (method, callback) {
      var methodName = _.camelCase(method);
      if (this[methodName] === undefined) {
        callback('Function ' + method + ' doesn\'t exist');
      }

      this[methodName](filtersTree, roomId, collection, filter[method])
        .then(function (subFormattedFilters) {
          formattedFilters = _.extend(formattedFilters, subFormattedFilters);
          callback();
        })
        .catch(function (error) {
          callback(error);
        });

    }.bind(this), function (error) {
      if (error) {
        deferred.reject(error);
      }

      if (Object.keys(formattedFilters)[0] !== 'or' || Object.keys(formattedFilters)[0] !== 'and') {
        formattedFilters = { and: formattedFilters };
      }

      deferred.resolve(formattedFilters);
    });

    return deferred.promise;
  },

  /**
   * Build rooms and filtersTree according to a given filter for must filter (and in nested filters)
   *
   * @param {Object} filtersTree pointer on object filtersTree defined in hotelClerkController
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @return {Promise} the formatted filter that need to be added to the room
   */
  must: function (filtersTree, roomId, collection, filters) {
    var
      deferred = q.defer(),
      formattedFilters;

    if (_.isEmpty(filters)) {
      deferred.reject('A filter can\'t be empty');
      return deferred.promise;
    }

    formattedFilters = {};

    if (!Array.isArray(filters)) {
      filters = [filters];
    }

    async.each(filters, function (filter, callback) {
      var
        method = Object.keys(filter)[0],
        methodName = _.camelCase(method);

      if (this[methodName] === undefined) {
        callback('Function ' + method + ' is not available in bool filter');
      }

      this[methodName](filtersTree, roomId, collection, filter[method])
        .then(function (subFormattedFilters) {
          formattedFilters = _.extend(formattedFilters, subFormattedFilters);
          callback();
        })
        .catch(function (error) {
          callback(error);
        });

    }.bind(this), function (error) {
      if (error) {
        deferred.reject(error);
      }

      deferred.resolve({and: formattedFilters});
    });

    return deferred.promise;
  },

  /**
   * Build rooms and filtersTree according to a given filter for must_not filter (and not in nested filters)
   *
   * @param {Object} filtersTree pointer on object filtersTree defined in hotelClerkController
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @return {Promise} the formatted filter that need to be added to the room
   */
  mustNot: function (filtersTree, roomId, collection, filter) {

  },

  /**
   * Build rooms and filtersTree according to a given filter for should filter (or in nested filters with a minimum should match option)
   *
   * @param {Object} filtersTree pointer on object filtersTree defined in hotelClerkController
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @return {Promise} the formatted filter that need to be added to the room
   */
  should: function (filtersTree, roomId, collection, filter) {

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

  }

};



var buildCurriedFunction = function (filtersTree, collection, field, operatorName, value, curriedFunctionName, roomId) {
  if (operators[operatorName] === undefined) {
    return {error: 'Operator ' + operatorName + ' doesn\'t exist'};
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