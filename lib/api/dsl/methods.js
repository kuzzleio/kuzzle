var
  _ = require('lodash'),
  async = require('async'),
  operators = require('./operators'),
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  KuzzleError = require('kuzzle-common-objects').Errors.kuzzleError,
  q = require('q'),
  util = require('util'),
  geohash = require('ngeohash'),
  geoUtil = require('./geoutil'),
  md5 = require('crypto-md5');

module.exports = function Methods(dslInstance) {
  /**
   * Reference to parent.
   */
  this.dsl = dslInstance;

  /**
   * Build rooms and filtersTree according to a given filter for 'term' filter (test equality)
   *
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, check if filters are not true
   * @return {Promise} the formatted filter that need to be added to the room
   */
  this.term = function (roomId, index, collection, filter, not) {
    return termFunction.call(this, 'term', roomId, index, collection, filter, not);
  };

  /**
   * Build rooms and filtersTree according to a given filter for 'terms' filter (test equality with one of given value in array)
   *
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, check if filters are not true
   * @return {Promise} the formatted filter that need to be added to the room
   */
  this.terms = function (roomId, index, collection, filter, not) {
    return termFunction.call(this, 'terms', roomId, index, collection, filter, not);
  };

  /**
   * Build filtersTree according to a given filter for 'range' filter and return the formatted filter
   * that can contains filters: gte, gt, lte, lt, from, to
   *
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, check if filters are not true
   * @return {Promise} the formatted filter that need to be added to the room
   */
  this.range = function (roomId, index, collection, filter, not) {
    var
      deferred = q.defer(),
      field,
      formattedFilters;

    if (_.isEmpty(filter)) {
      deferred.reject(new BadRequestError('A filter can\'t be empty'));
      return deferred.promise;
    }

    field = Object.keys(filter)[0];
    formattedFilters = {};

    async.each(Object.keys(filter[field]), (rangeOperator, callback) => {
      var
        value = filter[field][rangeOperator],
        encodedFunctionName = '',
        result;

      if (not) {
        encodedFunctionName += 'not';
      }
      encodedFunctionName += 'range' + field + rangeOperator + value;

      result = addToFiltersTree.call(this, index, collection, field, rangeOperator, value, encodedFunctionName, roomId, not);
      if (util.isError(result)) {
        callback(result);
        return false;
      }

      formattedFilters[result.path] = result.filter;

      callback();
    }, (error) => {
      if (error) {
        deferred.reject(error);
      }

      deferred.resolve({and: formattedFilters});
    });

    return deferred.promise;
  };

  /**
   * Build rooms and filtersTree according to a given filter for 'bool' filter (nested filters with ~and/or)
   *
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, check if filters are not true
   * @return {Promise} the formatted filter that need to be added to the room
   */
  this.bool = function (roomId, index, collection, filter, not) {
    var
      deferred = q.defer(),
      allowedBoolFunctions = ['must', 'mustNot', 'should'],
      formattedFilters = {};

    if (_.isEmpty(filter)) {
      deferred.reject(new BadRequestError('A filter can\'t be empty'));
      return deferred.promise;
    }

    async.each(Object.keys(filter), (method, callback) => {
      var methodName = _.camelCase(method);

      if (this[methodName] === undefined || allowedBoolFunctions.indexOf(methodName) === -1) {
        callback(new BadRequestError('Function ' + method + ' doesn\'t exist'));
        return false;
      }

      this[methodName](roomId, index, collection, filter[method], not)
        .then(function (subFormattedFilters) {
          formattedFilters = deepExtend(formattedFilters, subFormattedFilters);
          callback();
        })
        .catch(function (error) {
          callback(error);
        });

    }, (error) => {
      if (error) {
        return deferred.reject(error);
      }

      // check if there is an upper "and" that wrap the whole object
      if ((Object.keys(formattedFilters)[0] !== 'or' && Object.keys(formattedFilters)[0] !== 'and') ||
        Object.keys(formattedFilters).length > 1) {

        formattedFilters = {and: formattedFilters};
      }

      deferred.resolve(formattedFilters);
    });

    return deferred.promise;
  };

  /**
   * Build rooms and filtersTree according to a given filter for 'must' filter (and in nested filters)
   *
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @param {Boolean} not if not is true, check if filters are not true
   * @return {Promise} the formatted filter that need to be added to the room
   */
  this.must = function (roomId, index, collection, filters, not) {
    return getFormattedFilters.call(this, roomId, index, collection, filters, not)
      .then(formattedFilters => ({and: formattedFilters}));
  };

  /**
   * Build rooms and filtersTree according to a given filter for 'must_not' filter (and not in nested filters)
   *
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  this.mustNot = function (roomId, index, collection, filters, not) {
    if (not === undefined) {
      not = false;
    }

    return this.must(roomId, index, collection, filters, !not);
  };

  /**
   * Build rooms and filtersTree according to a given filter for 'should' filter
   * (or in nested filters with a minimum should match option)
   *
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  this.should = function (roomId, index, collection, filters, not) {
    if (not) {
      return this.and(roomId, index, collection, filters, not);
    }

    return this.or(roomId, index, collection, filters, not);
  };

  /**
   * Build rooms and filtersTree according to a given filter for 'and' filter
   *
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  this.and = function (roomId, index, collection, filters, not) {
    return getFormattedFilters.call(this, roomId, index, collection, filters, not)
      .then(formattedFilters => ({and: formattedFilters}));
  };

  /**
   * Build rooms and filtersTree according to a given filter for 'or' filter
   *
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  this.or = function (roomId, index, collection, filters, not) {
    return getFormattedFiltersAsList.call(this, roomId, index, collection, filters, not)
      .then(formattedFilters => ({or: formattedFilters}));
  };

  /**
   * Build rooms and filtersTree according to a given filter for 'not' filter
   *
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  this.not = function (roomId, index, collection, filters, not) {
    if (not === undefined) {
      not = false;
    }

    return this.must(roomId, index, collection, filters, !not);
  };

  /**
   * Build rooms and filtersTree according to a given filter for 'exists' filter
   *
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  this.exists = function (roomId, index, collection, filter, not) {
    var
      fieldName,
      formattedFilters,
      encodedFunctionName = '',
      inGlobals = false,
      result;

    if (_.isEmpty(filter)) {
      return q.reject(new BadRequestError('A filter can\'t be empty'));
    }

    fieldName = filter.field;

    if (!fieldName) {
      return q.reject(new BadRequestError('Filter \'exists\' must contains \'field\' attribute'));
    }

    if (typeof fieldName !== 'string') {
      return q.reject(new BadRequestError('Filter \'exists\' takes a string attribute. Found: ' + typeof fieldName));
    }

    formattedFilters = {};

    if (not) {
      encodedFunctionName += 'not';
      inGlobals = true;
    }
    // Clean the field in function name because can contains '.' and we don't want it in the function name
    encodedFunctionName += 'exists' + fieldName.split('.').join('');

    result = addToFiltersTree.call(this, index, collection, fieldName, 'exists', fieldName, encodedFunctionName, roomId, not, inGlobals);
    if (util.isError(result)) {
      return q.reject(result);
    }

    formattedFilters[result.path] = result.filter;

    return q(formattedFilters);
  };

  /**
   * Build rooms and filtersTree according to a given filter for 'ids' filter
   *
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  this.ids = function (roomId, index, collection, filter, not) {
    var
      formattedFilters,
      encodedFunctionName = '',
      result;

    if (_.isEmpty(filter)) {
      return q.reject(new BadRequestError('A filter can\'t be empty'));
    }

    if (!filter.values || _.isEmpty(filter.values)) {
      return q.reject(new BadRequestError('Filter ids must contains "values" attribute'));
    }

    if (!Array.isArray(filter.values) || _.isEmpty(filter.values)) {
      return q.reject(new BadRequestError('Attribute "values" in filter ids must contains a non-empty array'));
    }

    formattedFilters = {};

    if (not) {
      encodedFunctionName += 'not';
    }

    encodedFunctionName += 'ids_id' + filter.values;

    // We can use the 'terms' operators because is the same behaviour: check if the value in document match one of values in the filter
    result = addToFiltersTree.call(this, index, collection, '_id', 'terms', filter.values, encodedFunctionName, roomId, not, false);

    if (util.isError(result)) {
      return q.reject(result);
    }

    formattedFilters[result.path] = result.filter;

    return q(formattedFilters);
  };

  /**
   * Build rooms and filtersTree according to a given filter for 'geoBoundingBox' filter
   *
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  this.geoBoundingBox = function (roomId, index, collection, filter, not) {
    var
      encodedFunctionName,
      fieldName,
      formattedFilters = {},
      geoFilter,
      bBox,
      top,
      left,
      bottom,
      right,
      result;

    if (_.isEmpty(filter)) {
      return q.reject(new BadRequestError('Missing filter'));
    }

    fieldName = Object.keys(filter)[0];

    geoFilter = filter[fieldName];
    // elastic search DSL allows the undescore notation
    // we need an exception for the linter
    /* jshint camelcase: false */
    if (geoFilter.top_left) {
      geoFilter.topLeft = geoFilter.top_left;
      delete geoFilter.top_left;
    }
    if (geoFilter.bottom_right) {
      geoFilter.bottomRight = geoFilter.bottom_right;
      delete geoFilter.bottom_right;
    }
    /* jshint camelcase: true */

    try {
      bBox = geoUtil.constructBBox(geoFilter);
      top = bBox.top;
      left = bBox.left;
      bottom = bBox.bottom;
      right = bBox.right;
    }
    catch (err) {
      return q.reject(err);
    }

    encodedFunctionName = [fieldName, 'geoBoundingBox', geohash.encode(left, top), geohash.encode(right, bottom)].join('');
    if (not) {
      encodedFunctionName += 'not';
    }

    result = addToFiltersTree.call(this, 
      index,
      collection,
      fieldName,
      'geoBoundingBox',
      {top: top, left: left, right: right, bottom: bottom},
      encodedFunctionName,
      roomId,
      not
    );

    if (util.isError(result)) {
      return q.reject(result);
    }

    formattedFilters[result.path] = result.filter;

    return q(formattedFilters);
  };

  /**
   * Return true only if the point in field is in a specific distance from a geo point
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  this.geoDistance = function (roomId, index, collection, filter, not) {
    var
      encodedFunctionName,
      fieldName,
      formattedFilters = {},
      geoFilter,
      point,
      lat,
      lon,
      distance,
      result;

    if (_.isEmpty(filter)) {
      return q.reject(new BadRequestError('Missing filter'));
    }

    fieldName = Object.keys(filter).find(field => field !== 'distance');

    if (fieldName === undefined) {
      return q.reject(new BadRequestError('No location field given'));
    }

    geoFilter = filter[fieldName];

    // elastic search DSL allows the undescore notation
    // we need an exception for the linter
    /* jshint camelcase: false */
    if (geoFilter.lat_lon) {
      geoFilter.latLon = geoFilter.lat_lon;
      delete geoFilter.lat_lon;
    }
    /* jshint camelcase: true */

    if (!filter.distance) {
      return q.reject(new BadRequestError('No distance given'));
    }

    try {
      point = geoUtil.constructPoint(geoFilter);
      lat = point.lat;
      lon = point.lon;
      distance = geoUtil.getDistance(filter.distance);
    }
    catch (err) {
      return q.reject(err);
    }

    encodedFunctionName = [fieldName, 'geoDistance', geohash.encode(lat, lon), distance].join('');
    if (not) {
      encodedFunctionName += 'not';
    }

    result = addToFiltersTree.call(this, 
      index,
      collection,
      fieldName,
      'geoDistance',
      {lat: lat, lon: lon, distance: distance},
      encodedFunctionName,
      roomId,
      not
    );

    if (util.isError(result)) {
      return q.reject(result);
    }

    formattedFilters[result.path] = result.filter;

    return q(formattedFilters);
  };

  /**
   * Return true only if the point in field is in a range from a specific point
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  this.geoDistanceRange = function (roomId, index, collection, filter, not) {
    var
      encodedFunctionName,
      fieldName,
      formattedFilters = {},
      geoFilter,
      point,
      lat,
      lon,
      from,
      to,
      result;

    if (_.isEmpty(filter)) {
      return q.reject(new BadRequestError('Missing filter'));
    }

    fieldName = Object.keys(filter).find(field => field !== 'from' && field !== 'to');

    if (fieldName === undefined) {
      return q.reject(new BadRequestError('No location field given'));
    }

    geoFilter = filter[fieldName];
    // elastic search DSL allows the undescore notation
    // we need an exception for the linter
    /* jshint camelcase: false */
    if (geoFilter.lat_lon) {
      geoFilter.latLon = geoFilter.lat_lon;
      delete geoFilter.lat_lon;
    }
    /* jshint camelcase: true */

    if (!filter.from) {
      return q.reject(new BadRequestError('No from parameter given'));
    }
    if (!filter.to) {
      return q.reject(new BadRequestError('No to parameter given'));
    }

    try {
      point = geoUtil.constructPoint(geoFilter);
      lat = point.lat;
      lon = point.lon;

      from = geoUtil.getDistance(filter.from);
      to = geoUtil.getDistance(filter.to);
    }
    catch (err) {
      return q.reject(err);
    }

    encodedFunctionName = [fieldName, 'geoDistanceRange', geohash.encode(lat, lon), from, to].join('');
    if (not) {
      encodedFunctionName += 'not';
    }

    result = addToFiltersTree.call(this, 
      index,
      collection,
      fieldName,
      'geoDistanceRange',
      {lat: lat, lon: lon, from: from, to: to},
      encodedFunctionName,
      roomId,
      not
    );

    if (util.isError(result)) {
      return q.reject(result);
    }

    formattedFilters[result.path] = result.filter;

    return q(formattedFilters);
  };

  /**
   * Return true only if the point in field is included in a polygon
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  this.geoPolygon = function (roomId, index, collection, filter, not) {
    var
      encodedFunctionName,
      fieldName,
      formattedFilters = {},
      geoFilter,
      polygon,
      geoHashPolygon = [],
      result;

    if (_.isEmpty(filter)) {
      return q.reject(new BadRequestError('Missing filter'));
    }

    fieldName = Object.keys(filter)[0];
    geoFilter = filter[fieldName];

    try {
      polygon = geoUtil.constructPolygon(geoFilter);
    }
    catch (err) {
      return q.reject(err);
    }

    polygon.forEach(point => geoHashPolygon.push(geohash.encode(point.lat, point.lon)));

    encodedFunctionName = [fieldName, 'geoPolygon', geoHashPolygon.join('')].join('');
    if (not) {
      encodedFunctionName += 'not';
    }

    result = addToFiltersTree.call(this, 
      index,
      collection,
      fieldName,
      'geoPolygon',
      polygon,
      encodedFunctionName,
      roomId,
      not
    );

    if (util.isError(result)) {
      return q.reject(result);
    }

    formattedFilters[result.path] = result.filter;

    return q(formattedFilters);
  };

  /**
   * Return true only if the point in field is in the square
   */
  this.geoShape = function () {
    return q.reject(new KuzzleError('geoShape is not implemented yet.'));
  };

  /**
   * Return true only if the value in field pass the regexp test
   */
  this.regexp = function () {
    return q.reject(new KuzzleError('regexp is not implemented yet.'));
  };

  /**
   * Build rooms and filtersTree according to a given filter for 'missing' filter
   *
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  this.missing = function (roomId, index, collection, filter, not) {
    var
      fieldName,
      formattedFilters,
      encodedFunctionName = '',
      inGlobals = false,
      result;

    if (_.isEmpty(filter)) {
      return q.reject(new BadRequestError('A filter can\'t be empty'));
    }

    fieldName = filter.field;

    if (!fieldName) {
      return q.reject(new BadRequestError('Filter \'missing\' must contains \'field\' attribute'));
    }

    formattedFilters = {};

    if (not) {
      encodedFunctionName += 'not';
      inGlobals = true;
    }

    // Clean the field in function name because can contains '.' and we don't want it in the function name
    encodedFunctionName += 'missing' + fieldName.split('.').join('');

    result = addToFiltersTree.call(this, index, collection, fieldName, 'missing', fieldName, encodedFunctionName, roomId, not, inGlobals);
    if (util.isError(result)) {
      return q.reject(result);
    }

    formattedFilters[result.path] = result.filter;

    return q(formattedFilters);
  };
};

/**
 * Fill object filtersTree with the new filter added by user
 *
 * @param {String} index the index name
 * @param {String} collection the collection name
 * @param {String} field the field where we need to apply the filter
 * @param {String} operator the operator name that the user wants to execute against the document (defined in operator.js)
 * @param {*} value the value to test on the field
 * @param {String} encodedFunctionName
 * @param {String} roomId
 * @param {Boolean} not
 * @param {Boolean} [inGlobals] true if the roomId must be added in global room for the collection (eg, for 'not exists' filter)
 * @returns {Object} an object with the path and the new filter
 */
function addToFiltersTree(index, collection, field, operator, value, encodedFunctionName, roomId, not, inGlobals) {
  var
    hashedFunctionName = md5(encodedFunctionName),
    path = index + '.' + collection + '.' + field + '.' + hashedFunctionName;

  if (operators[operator] === undefined) {
    return new BadRequestError(`Operator ${operator} doesn't exist`);
  }

  if (!this.dsl.filtersTree[index]) {
    this.dsl.filtersTree[index] = {};
  }

  if (!this.dsl.filtersTree[index][collection]) {
    this.dsl.filtersTree[index][collection] = {};
  }

  if (!this.dsl.filtersTree[index][collection].fields) {
    this.dsl.filtersTree[index][collection].fields = {};
  }

  if (!this.dsl.filtersTree[index][collection].fields[field]) {
    this.dsl.filtersTree[index][collection].fields[field] = {};
  }

  if (!this.dsl.filtersTree[index][collection].fields[field][hashedFunctionName]) {
    this.dsl.filtersTree[index][collection].fields[field][hashedFunctionName] = {
      rooms: [],
      args: {operator, not, field, value}
    };
  }

  if (this.dsl.filtersTree[index][collection].fields[field][hashedFunctionName].rooms.indexOf(roomId) === -1) {
    this.dsl.filtersTree[index][collection].fields[field][hashedFunctionName].rooms.push(roomId);
  }

  if (inGlobals) {
    if (!this.dsl.filtersTree[index][collection].rooms) {
      this.dsl.filtersTree[index][collection].rooms = [];
    }

    if (this.dsl.filtersTree[index][collection].rooms.indexOf(roomId) === -1) {
      this.dsl.filtersTree[index][collection].rooms.push(roomId);
    }
  }

  return {
    path: path,
    filter: this.dsl.filtersTree[index][collection].fields[field][hashedFunctionName]
  };
}

/**
 * Construct the formattedFilters for filters with conditional operand (bool, and, or, ...)
 *
 * @param {String} roomId
 * @param {String} index
 * @param {String} collection
 * @param {Object} filters given by user on subscribe
 * @param {Boolean} not if not is true, invert the boolean result
 * @return {Promise} the formatted filter that need to be added to the room
 */
function getFormattedFilters(roomId, index, collection, filters, not) {
  var
    deferred = q.defer(),
    formattedFilters;

  if (_.isEmpty(filters)) {
    deferred.reject(new BadRequestError('Filters can\'t be empty'));
    return deferred.promise;
  }

  formattedFilters = {};

  if (!Array.isArray(filters)) {
    filters = [filters];
  }

  async.each(filters, (filter, callback) => {
    var
      method,
      methodName;

    if (_.isEmpty(filter)) {
      // just ignore if one of filters is empty, we don't have to rise an error
      callback();
      return false;
    }

    method = Object.keys(filter)[0];
    methodName = _.camelCase(method);

    if (this[methodName] === undefined) {
      callback(new BadRequestError('Function ' + method + ' doesn\'t exist'));
      return false;
    }

    this[methodName].call(this, roomId, index, collection, filter[method], not)
      .then(subFormattedFilters => {
        formattedFilters = deepExtend(formattedFilters, subFormattedFilters);
        callback();
      })
      .catch(error => {
        callback(error);
      });

  }, (error) => {
    if (error) {
      deferred.reject(error);
    }

    deferred.resolve(formattedFilters);
  });

  return deferred.promise;
}

/**
 * Build formattedFilters as list for operand like OR and SHOULD
 *
 * @param {string} roomId
 * @param {string} index
 * @param {string} collection
 * @param {Object} filters
 * @param {boolean} not
 * @returns {Promise}
 */
function getFormattedFiltersAsList (roomId, index, collection, filters, not) {
  var
    deferred = q.defer(),
    formattedFilters = [];

  if (!Array.isArray(filters) || filters.length === 0) {
    deferred.reject(new BadRequestError('This filter must contains a filters array'));
    return deferred.promise;
  }


  async.each(filters, (filter, callback) => {
    getFormattedFilters.call(this, roomId, index, collection, filter, not)
      .then(formattedFilter => {
        formattedFilters.push(formattedFilter);
        callback();
      })
      .catch(error => {
        callback(error);
      });
  }, error => {
    if (error) {
      return deferred.reject(error);
    }

    return deferred.resolve(formattedFilters);
  });

  return deferred.promise;
}

/**
 * Allow to merge two object and merge extend entries "and" and "or"
 * @param {Object} filters1
 * @param {Object} filters2
 * @returns {Object} the merged object
 */
function deepExtend(filters1, filters2) {
  var
    attr,
    resultFilters;

  if (_.isEmpty(filters1)) {
    return filters2;
  }
  if (_.isEmpty(filters2)) {
    return filters1;
  }

  resultFilters = _.clone(filters1);

  for (attr in filters2) {
    if (filters2.hasOwnProperty(attr)) {
      if (!resultFilters[attr]) {
        resultFilters[attr] = filters2[attr];
      }
      else if (attr === 'and' || attr === 'or') {
        resultFilters[attr] = deepExtend(resultFilters[attr], filters2[attr]);
      }
    }
  }

  return resultFilters;
}

/**
 * Allow to build filter for "term" and "terms" filters
 *
 * @param {String} termType "term" or "terms"
 * @param {String} roomId
 * @param {String} index
 * @param {String} collection
 * @param {Object} filter given by user on subscribe
 * @param {Boolean} not if not is true, check if filters are not true
 * @return {Promise} the formatted filter that need to be added to the room
 */
function termFunction(termType, roomId, index, collection, filter, not) {
  var
    field,
    value,
    formattedFilters,
    encodedFunctionName = '',
    result;

  if (_.isEmpty(filter)) {
    return q.reject(new BadRequestError('A filter can\'t be empty'));
  }

  field = Object.keys(filter)[0];
  value = filter[field];
  formattedFilters = {};

  if (termType === 'terms' && !Array.isArray(value)) {
    return q.reject(new BadRequestError('Filter terms must contains an array'));
  }

  if (not) {
    encodedFunctionName += 'not';
  }
  // Clean the field in function name because can contains '.' and we don't want it in the function name
  encodedFunctionName += termType + field.split('.').join('') + value;

  result = addToFiltersTree.call(this, index, collection, field, termType, value, encodedFunctionName, roomId, not);
  if (util.isError(result)) {
    return q.reject(result);
  }

  formattedFilters[result.path] = result.filter;

  return q(formattedFilters);
}
