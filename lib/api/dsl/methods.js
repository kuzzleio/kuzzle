var
  _ = require('lodash'),
  async = require('async'),
  operators = require('./operators'),
  BadRequestError = require('../core/errors/badRequestError'),
  KuzzleError = require('../core/errors/kuzzleError'),
  q = require('q'),
  util = require('util'),
  geohash = require('ngeohash'),
  units = require('node-units'),
  methods,
  geoUtil = {};

module.exports = methods = {

  /**
   * Reference to parent. Initialized by the Dsl object
   */
  dsl: {},

  /**
   * Build rooms and filtersTree according to a given filter for 'term' filter (test equality)
   *
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, check if filters are not true
   * @return {Promise} the formatted filter that need to be added to the room
   */
  term: function (roomId, collection, filter, not) {
    return termFunction('term', roomId, collection, filter, not);
  },

  /**
   * Build rooms and filtersTree according to a given filter for 'terms' filter (test equality with one of given value in array)
   *
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, check if filters are not true
   * @return {Promise} the formatted filter that need to be added to the room
   */
  terms: function (roomId, collection, filter, not) {
    return termFunction('terms', roomId, collection, filter, not);
  },

  /**
   * Build filtersTree according to a given filter for 'range' filter and return the formatted filter
   * that can contains filters: gte, gt, lte, lt, from, to
   *
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, check if filters are not true
   * @return {Promise} the formatted filter that need to be added to the room
   */
  range: function (roomId, collection, filter, not) {
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

    async.each(Object.keys(filter[field]), function (fn, callback) {
      var
        value = filter[field][fn],
        curriedFunctionName = '',
        result;

      if (not) {
        curriedFunctionName += 'not';
      }
      curriedFunctionName += 'range' + field + fn + value;

      result = buildCurriedFunction(collection, field, fn, value, curriedFunctionName, roomId, not);
      if (util.isError(result)) {
        callback(result);
        return false;
      }

      formattedFilters[result.path] = result.filter;

      callback();
    }, function (error) {
      if (error) {
        deferred.reject(error);
      }

      deferred.resolve({and: formattedFilters});
    });

    return deferred.promise;
  },

  /**
   * Build rooms and filtersTree according to a given filter for 'bool' filter (nested filters with ~and/or)
   *
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, check if filters are not true
   * @return {Promise} the formatted filter that need to be added to the room
   */
  bool: function (roomId, collection, filter, not) {
    var
      deferred = q.defer(),
      allowedBoolFunctions = ['must', 'mustNot', 'should'],
      formattedFilters = {};

    if (_.isEmpty(filter)) {
      deferred.reject(new BadRequestError('A filter can\'t be empty'));
      return deferred.promise;
    }

    async.each(Object.keys(filter), function (method, callback) {
      var methodName = _.camelCase(method);

      if (this[methodName] === undefined || allowedBoolFunctions.indexOf(methodName) === -1) {
        callback(new BadRequestError('Function ' + method + ' doesn\'t exist'));
        return false;
      }

      this[methodName](roomId, collection, filter[method], not)
        .then(function (subFormattedFilters) {
          formattedFilters = deepExtend(formattedFilters, subFormattedFilters);
          callback();
        })
        .catch(function (error) {
          callback(error);
        });

    }.bind(this), function (error) {
      if (error) {
        deferred.reject(error);
      }

      // check if there is an upper "and" that wrap the whole object
      if ((Object.keys(formattedFilters)[0] !== 'or' && Object.keys(formattedFilters)[0] !== 'and') ||
        Object.keys(formattedFilters).length > 1) {

        formattedFilters = {and: formattedFilters};
      }

      deferred.resolve(formattedFilters);
    });

    return deferred.promise;
  },

  /**
   * Build rooms and filtersTree according to a given filter for 'must' filter (and in nested filters)
   *
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @param {Boolean} not if not is true, check if filters are not true
   * @return {Promise} the formatted filter that need to be added to the room
   */
  must: function (roomId, collection, filters, not) {
    var deferred = q.defer();

    getFormattedFilters(roomId, collection, filters, not)
      .then(function (formattedFilters) {
        deferred.resolve({and: formattedFilters});
      })
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
  },

  /**
   * Build rooms and filtersTree according to a given filter for 'must_not' filter (and not in nested filters)
   *
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  mustNot: function (roomId, collection, filters, not) {
    if (not === undefined) {
      not = false;
    }

    return this.must(roomId, collection, filters, !not);
  },

  /**
   * Build rooms and filtersTree according to a given filter for 'should' filter (or in nested filters with a minimum should match option)
   *
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  should: function (roomId, collection, filters, not) {
    if (not) {
      return this.and(roomId, collection, filters, not);
    }

    return this.or(roomId, collection, filters, not);
  },

  /**
   * Build rooms and filtersTree according to a given filter for 'and' filter
   *
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  and: function (roomId, collection, filters, not) {
    var deferred = q.defer();

    getFormattedFilters(roomId, collection, filters, not)
      .then(function (formattedFilters) {
        deferred.resolve({and: formattedFilters});
      })
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
  },

  /**
   * Build rooms and filtersTree according to a given filter for 'or' filter
   *
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  or: function (roomId, collection, filters, not) {
    var
      deferred = q.defer();

    getFormattedFiltersAsList(roomId, collection, filters, not)
      .then(formattedFilters => {
        return deferred.resolve({or: formattedFilters});
      })
      .catch(error => {
        return deferred.reject(error);
      });

    return deferred.promise;
  },

  /**
   * Build rooms and filtersTree according to a given filter for 'not' filter
   *
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  not: function (roomId, collection, filters, not) {
    if (not === undefined) {
      not = false;
    }

    return this.must(roomId, collection, filters, !not);
  },

  /**
   * Build rooms and filtersTree according to a given filter for 'exists' filter
   *
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  exists: function (roomId, collection, filter, not) {
    var
      deferred = q.defer(),
      fieldName,
      formattedFilters,
      curriedFunctionName = '',
      inGlobals = false,
      result;

    if (_.isEmpty(filter)) {
      deferred.reject(new BadRequestError('A filter can\'t be empty'));
      return deferred.promise;
    }

    fieldName = filter.field;

    if (!fieldName) {
      deferred.reject(new BadRequestError('Filter \'exists\' must contains \'field\' attribute'));
      return deferred.promise;
    }

    if (typeof fieldName !== 'string') {
      deferred.reject(new BadRequestError('Filter \'exists\' takes a string attribute. Found: ' + typeof fieldName));
      return deferred.promise;
    }

    formattedFilters = {};

    if (not) {
      curriedFunctionName += 'not';
      inGlobals = true;
    }
    // Clean the field in function name because can contains '.' and we don't want it in the function name
    curriedFunctionName += 'exists' + fieldName.split('.').join('');

    result = buildCurriedFunction(collection, fieldName, 'exists', fieldName, curriedFunctionName, roomId, not, inGlobals);
    if (util.isError(result)) {
      deferred.reject(result);
      return deferred.promise;
    }

    formattedFilters[result.path] = result.filter;

    deferred.resolve(formattedFilters);
    return deferred.promise;
  },

  /**
   * Build rooms and filtersTree according to a given filter for 'ids' filter
   *
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  ids: function (roomId, collection, filter, not) {
    var
      deferred = q.defer(),
      formattedFilters,
      curriedFunctionName = '',
      result;

    if (_.isEmpty(filter)) {
      deferred.reject(new BadRequestError('A filter can\'t be empty'));
      return deferred.promise;
    }

    if (!filter.values || _.isEmpty(filter.values)) {
      deferred.reject(new BadRequestError('Filter ids must contains "values" attribute'));
      return deferred.promise;
    }

    if (!Array.isArray(filter.values) || _.isEmpty(filter.values)) {
      deferred.reject(new BadRequestError('Attribute "values" in filter ids must contains a non-empty array'));
      return deferred.promise;
    }

    formattedFilters = {};

    if (not) {
      curriedFunctionName += 'not';
    }

    curriedFunctionName += 'ids_id' + filter.values;

    // We can use the 'terms' operators because is the same behaviour: check if the value in document match one of values in the filter
    result = buildCurriedFunction(collection, '_id', 'terms', filter.values, curriedFunctionName, roomId, not, false);

    if (util.isError(result)) {
      deferred.reject(result);
      return deferred.promise;
    }

    formattedFilters[result.path] = result.filter;

    deferred.resolve(formattedFilters);
    return deferred.promise;
  },

  /**
   * Build rooms and filtersTree according to a given filter for 'geoBoundingBox' filter
   *
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  geoBoundingBox: function (roomId, collection, filter, not) {
    var
      curriedFunctionName,
      deferred = q.defer(),
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
      deferred.reject(new BadRequestError('Missing filter'));
      return deferred.promise;
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
      deferred.reject(err);
      return deferred.promise;
    }

    curriedFunctionName = [fieldName, 'geoBoundingBox', geohash.encode(left, top), geohash.encode(right, bottom)].join('');
    if (not) {
      curriedFunctionName += 'not';
    }

    result = buildCurriedFunction(
      collection,
      fieldName,
      'geoBoundingBox',
      {top: top, left: left, right: right, bottom: bottom},
      curriedFunctionName,
      roomId,
      not
    );

    if (util.isError(result)) {
      deferred.reject(result);
      return deferred.promise;
    }

    formattedFilters[result.path] = result.filter;

    deferred.resolve(formattedFilters);
    return deferred.promise;
  },

  /**
   * Return true only if the point in field is in a specific distance from a geo point
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  geoDistance: function (roomId, collection, filter, not) {
    var
      curriedFunctionName,
      deferred = q.defer(),
      fieldName,
      formattedFilters = {},
      geoFilter,
      point,
      lat,
      lon,
      distance,
      result;

    if (_.isEmpty(filter)) {
      deferred.reject(new BadRequestError('Missing filter'));
      return deferred.promise;
    }

    try {
      Object.keys(filter).forEach(function (field) {
        if (field !== 'distance') {
          fieldName = field;
          return false;
        }
      });

      if (fieldName === undefined) {
        throw new BadRequestError('No location field given');
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
        throw new BadRequestError('No distance given');
      }

      point = geoUtil.constructPoint(geoFilter);
      lat = point.lat;
      lon = point.lon;
      distance = geoUtil.getDistance(filter.distance);

    }
    catch (err) {
      deferred.reject(err);
      return deferred.promise;
    }

    curriedFunctionName = [fieldName, 'geoDistance', geohash.encode(lat, lon), distance].join('');
    if (not) {
      curriedFunctionName += 'not';
    }

    result = buildCurriedFunction(
      collection,
      fieldName,
      'geoDistance',
      {lat: lat, lon: lon, distance: distance},
      curriedFunctionName,
      roomId,
      not
    );

    if (util.isError(result)) {
      deferred.reject(result);
      return deferred.promise;
    }

    formattedFilters[result.path] = result.filter;

    deferred.resolve(formattedFilters);
    return deferred.promise;
  },

  /**
   * Return true only if the point in field is in a range from a specific point
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  geoDistanceRange: function (roomId, collection, filter, not) {
    var
      curriedFunctionName,
      deferred = q.defer(),
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
      deferred.reject(new BadRequestError('Missing filter'));
      return deferred.promise;
    }

    try {
      Object.keys(filter).forEach(function (field) {
        if (field !== 'from' && field !== 'to') {
          fieldName = field;
          return false;
        }
      });

      if (fieldName === undefined) {
        throw new BadRequestError('No location field given');
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
        throw new BadRequestError('No from parameter given');
      }
      if (!filter.to) {
        throw new BadRequestError('No to parameter given');
      }

      point = geoUtil.constructPoint(geoFilter);
      lat = point.lat;
      lon = point.lon;

      from = geoUtil.getDistance(filter.from);
      to = geoUtil.getDistance(filter.to);

    }
    catch (err) {
      deferred.reject(err);
      return deferred.promise;
    }

    curriedFunctionName = [fieldName, 'geoDistanceRange', geohash.encode(lat, lon), from, to].join('');
    if (not) {
      curriedFunctionName += 'not';
    }

    result = buildCurriedFunction(
      collection,
      fieldName,
      'geoDistanceRange',
      {lat: lat, lon: lon, from: from, to: to},
      curriedFunctionName,
      roomId,
      not
    );

    if (util.isError(result)) {
      deferred.reject(result);
      return deferred.promise;
    }

    formattedFilters[result.path] = result.filter;

    deferred.resolve(formattedFilters);
    return deferred.promise;
  },

  /**
   * Return true only if the point in field is included in a polygon
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  geoPolygon: function (roomId, collection, filter, not) {
    var
      curriedFunctionName,
      deferred = q.defer(),
      fieldName,
      formattedFilters = {},
      geoFilter,
      polygon,
      geoHashPolygon = [],
      result;

    if (_.isEmpty(filter)) {
      deferred.reject(new BadRequestError('Missing filter'));
      return deferred.promise;
    }

    try {

      fieldName = Object.keys(filter)[0];

      geoFilter = filter[fieldName];

      polygon = geoUtil.constructPolygon(geoFilter);

    }
    catch (err) {
      deferred.reject(err);
      return deferred.promise;
    }

    polygon.forEach(function (point) {
      geoHashPolygon.push(geohash.encode(point.lat, point.lon));
    });

    curriedFunctionName = [fieldName, 'geoPolygon', geoHashPolygon.join('')].join('');
    if (not) {
      curriedFunctionName += 'not';
    }

    result = buildCurriedFunction(
      collection,
      fieldName,
      'geoPolygon',
      polygon,
      curriedFunctionName,
      roomId,
      not
    );

    if (util.isError(result)) {
      deferred.reject(result);
      return deferred.promise;
    }

    formattedFilters[result.path] = result.filter;

    deferred.resolve(formattedFilters);
    return deferred.promise;
  },

  /**
   * Return true only if the point in field is in the square
   */
  geoShape: function () {
    var deferred = q.defer();

    deferred.reject(new KuzzleError('geoShape is not implemented yet.'));
    return deferred.promise;
  },

  /**
   * Return true only if the value in field pass the regexp test
   */
  regexp: function () {
    var deferred = q.defer();

    deferred.reject(new KuzzleError('regexp is not implemented yet.'));
    return deferred.promise;
  },

  /**
   * Build rooms and filtersTree according to a given filter for 'missing' filter
   *
   * @param {String} roomId
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  missing: function (roomId, collection, filter, not) {
    var
      deferred = q.defer(),
      fieldName,
      formattedFilters,
      curriedFunctionName = '',
      inGlobals = false,
      result;

    if (_.isEmpty(filter)) {
      deferred.reject(new BadRequestError('A filter can\'t be empty'));
      return deferred.promise;
    }

    fieldName = filter.field;

    if (!fieldName) {
      deferred.reject(new BadRequestError('Filter \'missing\' must contains \'field\' attribute'));
      return deferred.promise;
    }

    formattedFilters = {};

    if (not) {
      curriedFunctionName += 'not';
      inGlobals = true;
    }
    // Clean the field in function name because can contains '.' and we don't want it in the function name
    curriedFunctionName += 'missing' + fieldName.split('.').join('');

    result = buildCurriedFunction(collection, fieldName, 'missing', fieldName, curriedFunctionName, roomId, not, inGlobals);
    if (util.isError(result)) {
      deferred.reject(result);
      return deferred.promise;
    }

    formattedFilters[result.path] = result.filter;

    deferred.resolve(formattedFilters);
    return deferred.promise;
  }
};


/**
 * Fill object filtersTree with the new filter added by user
 *
 * @param {String} collection the collection name
 * @param {String} field the field where we need to apply the filter
 * @param {String} operatorName the operator name that the user wants to execute against the document (defined in operator.js)
 * @param {*} value the value to test on the field
 * @param {String} curriedFunctionName
 * @param {String} roomId
 * @param {Boolean} not
 * @param {Boolean} inGlobals true if the roomId must be added in global room for the collection (eg, for 'not exists' filter)
 * @returns {Object} an object with the path and the new filter
 */
function buildCurriedFunction(collection, field, operatorName, value, curriedFunctionName, roomId, not, inGlobals) {
  var
    curriedFunction,
    path = collection + '.' + field + '.' + curriedFunctionName;

  if (operators[operatorName] === undefined) {
    return new BadRequestError('Operator ' + operatorName + ' doesn\'t exist');
  }

  if (!methods.dsl.filtersTree[collection]) {
    methods.dsl.filtersTree[collection] = {};
  }

  if (!methods.dsl.filtersTree[collection].fields) {
    methods.dsl.filtersTree[collection].fields = {};
  }

  if (!methods.dsl.filtersTree[collection].fields[field]) {
    methods.dsl.filtersTree[collection].fields[field] = {};
  }

  if (!methods.dsl.filtersTree[collection].fields[field][curriedFunctionName]) {
    curriedFunction = _.curry(operators[operatorName]);
    curriedFunction = _.curry(curriedFunction(field, value));
    if (not) {
      curriedFunction = _.negate(curriedFunction);
    }

    methods.dsl.filtersTree[collection].fields[field][curriedFunctionName] = {
      rooms: [],
      fn: curriedFunction
    };
  }

  if (methods.dsl.filtersTree[collection].fields[field][curriedFunctionName].rooms.indexOf(roomId) === -1) {
    methods.dsl.filtersTree[collection].fields[field][curriedFunctionName].rooms.push(roomId);
  }

  if (inGlobals) {
    if (!methods.dsl.filtersTree[collection].rooms) {
      methods.dsl.filtersTree[collection].rooms = [];
    }

    if (methods.dsl.filtersTree[collection].rooms.indexOf(roomId) === -1) {
      methods.dsl.filtersTree[collection].rooms.push(roomId);
    }
  }

  return {
    path: path,
    filter: methods.dsl.filtersTree[collection].fields[field][curriedFunctionName]
  };
}

/**
 * Construct the formattedFilters for filters with conditional operand (bool, and, or, ...)
 *
 * @param {String} roomId
 * @param {String} collection
 * @param {Object} filters given by user on subscribe
 * @param {Boolean} not if not is true, invert the boolean result
 * @return {Promise} the formatted filter that need to be added to the room
 */
function getFormattedFilters(roomId, collection, filters, not) {
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

  async.each(filters, function (filter, callback) {
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

    if (methods[methodName] === undefined) {
      callback(new BadRequestError('Function ' + method + ' doesn\'t exist'));
      return false;
    }

    methods[methodName](roomId, collection, filter[method], not)
      .then(function (subFormattedFilters) {
        formattedFilters = deepExtend(formattedFilters, subFormattedFilters);
        callback();
      })
      .catch(function (error) {
        callback(error);
      });

  }, function (error) {
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
 * @param {string} collection
 * @param {Object} filters
 * @param {boolean} not
 * @returns {Promise}
 */
function getFormattedFiltersAsList (roomId, collection, filters, not) {
  var
    deferred = q.defer(),
    formattedFilters = [];

  if (!Array.isArray(filters) || filters.length === 0) {
    deferred.reject(new BadRequestError('This filter must contains a filters array'));
    return deferred.promise;
  }

  async.each(filters, (filter, callback) => {
    getFormattedFilters(roomId, collection, filter, not)
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
function deepExtend (filters1, filters2) {
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
 * @param {String} collection
 * @param {Object} filter given by user on subscribe
 * @param {Boolean} not if not is true, check if filters are not true
 * @return {Promise} the formatted filter that need to be added to the room
 */
function termFunction (termType, roomId, collection, filter, not) {
  var
    deferred = q.defer(),
    field,
    value,
    formattedFilters,
    curriedFunctionName = '',
    result;

  if (_.isEmpty(filter)) {
    deferred.reject(new BadRequestError('A filter can\'t be empty'));
    return deferred.promise;
  }

  field = Object.keys(filter)[0];
  value = filter[field];
  formattedFilters = {};

  if (termType === 'terms' && !Array.isArray(value)) {
    deferred.reject(new BadRequestError('Filter terms must contains an array'));
    return deferred.promise;
  }

  if (not) {
    curriedFunctionName += 'not';
  }
  // Clean the field in function name because can contains '.' and we don't want it in the function name
  curriedFunctionName += termType + field.split('.').join('') + value;

  result = buildCurriedFunction(collection, field, termType, value, curriedFunctionName, roomId, not);
  if (util.isError(result)) {
    deferred.reject(result);
    return deferred.promise;
  }

  formattedFilters[result.path] = result.filter;

  deferred.resolve(formattedFilters);
  return deferred.promise;
}

geoUtil = {
  /**
   * Construct a valid usable BBox
   *
   * @param {Object} geoFilter the given object
   * @return {Object} the valid usable BBox object
   */
  constructBBox: function (geoFilter) {
    var top, left, bottom, right, tmp;
    // { top: -74.1, left: 40.73, bottom: -71.12, right: 40.01 }
    if (geoFilter.top &&
      geoFilter.left &&
      geoFilter.bottom &&
      geoFilter.right
    ) {
      top = geoFilter.top;
      left = geoFilter.left;
      bottom = geoFilter.bottom;
      right = geoFilter.right;
    }
    // { topLeft: { lat: 40.73, lon: -74.1 }, bottomRight: { lat: 40.01, lon: -71.12 } }
    else if (geoFilter.topLeft &&
      geoFilter.bottomRight &&
      geoFilter.topLeft.lat &&
      geoFilter.topLeft.lon &&
      geoFilter.bottomRight.lat &&
      geoFilter.bottomRight.lon
    ) {
      top = geoFilter.topLeft.lon;
      left = geoFilter.topLeft.lat;
      bottom = geoFilter.bottomRight.lon;
      right = geoFilter.bottomRight.lat;
    }
    // { topLeft: [ -74.1, 40.73 ], bottomRight: [ -71.12, 40.01 ] }
    else if (geoFilter.topLeft &&
      geoFilter.bottomRight &&
      _.isArray(geoFilter.topLeft) &&
      _.isArray(geoFilter.bottomRight)
    ) {
      top = geoFilter.topLeft[0];
      left = geoFilter.topLeft[1];
      bottom = geoFilter.bottomRight[0];
      right = geoFilter.bottomRight[1];
    }
    // { topLeft: "40.73, -74.1", bottomRight: "40.01, -71.12" }
    else if (geoFilter.topLeft &&
      geoFilter.bottomRight &&
      _.isString(geoFilter.topLeft) &&
      _.isString(geoFilter.bottomRight) &&
      /^[-.0-9]+,\s*[-.0-9]+$/.test(geoFilter.topLeft) &&
      /^[-.0-9]+,\s*[-.0-9]+$/.test(geoFilter.bottomRight)
    ) {
      tmp = geoFilter.topLeft.match(/^([-.0-9]+),\s*([-.0-9]+)$/);
      top = tmp[2];
      left = tmp[1];

      tmp = geoFilter.bottomRight.match(/^([-.0-9]+),\s*([-.0-9]+)$/);
      bottom = tmp[2];
      right = tmp[1];
    }
    // { topLeft: "dr5r9ydj2y73", bottomRight: "drj7teegpus6" }
    else if (geoFilter.topLeft &&
      geoFilter.bottomRight &&
      _.isString(geoFilter.topLeft) &&
      _.isString(geoFilter.bottomRight) &&
      /^[0-9a-z]{4,}$/.test(geoFilter.topLeft) &&
      /^[0-9a-z]{4,}$/.test(geoFilter.bottomRight)
    ) {
      tmp = geohash.decode(geoFilter.topLeft);
      top = tmp.longitude;
      left = tmp.latitude;

      tmp = geohash.decode(geoFilter.bottomRight);
      bottom = tmp.longitude;
      right = tmp.latitude;
    }

    if (top && left && bottom && right) {
      if (!_.isNumber(top)) {
        top = parseFloat(top);
      }
      if (!_.isNumber(left)) {
        left = parseFloat(left);
      }
      if (!_.isNumber(bottom)) {
        bottom = parseFloat(bottom);
      }
      if (!_.isNumber(right)) {
        right = parseFloat(right);
      }
    }
    else {
      throw new BadRequestError('Unable to parse coordinates');
    }

    return {top: top, left: left, bottom: bottom, right: right};
  },

  /**
   * Construct a valid usable BBox
   *
   * @param {Object} geoFilter the given object
   * @return {Object} the valid usable BBox object
   */
  constructPolygon: function (geoFilter) {
    var point,
      polygon = [];

    if (geoFilter.points === undefined) {
      throw new BadRequestError('No point list found');
    }

    if (!_.isArray(geoFilter.points)) {
      throw new BadRequestError('A polygon must be in array format');
    }

    if (geoFilter.points.length < 3) {
      throw new BadRequestError('A polygon must have at least 3 points');
    }

    geoFilter.points.forEach(function (entry) {
      point = geoUtil.constructPoint(entry);
      polygon.push(point);
    });

    return polygon;
  },

  /**
   * Construct a valid usable point
   *
   * @param {Object} geoFilter the given object
   * @return {Object} the valid usable point object
   */
  constructPoint: function (geoFilter) {
    var lat, lon, tmp;

    // { lat: -74.1, lon: 40.73 }
    if (geoFilter.lat !== undefined &&
      geoFilter.lon !== undefined
    ) {
      lat = geoFilter.lat;
      lon = geoFilter.lon;
    }
    // { latLon: { lat: 40.73, lon: -74.1 } }
    else if (geoFilter.latLon &&
      geoFilter.latLon.lat !== undefined &&
      geoFilter.latLon.lon !== undefined
    ) {
      lat = geoFilter.latLon.lat;
      lon = geoFilter.latLon.lon;
    }
    // { latLon: [ -74.1, 40.73 ] }
    else if (geoFilter.latLon &&
      _.isArray(geoFilter.latLon)
    ) {
      lat = geoFilter.latLon[0];
      lon = geoFilter.latLon[1];
    }
    // { latLon: "40.73, -74.1" }
    else if (geoFilter.latLon &&
      _.isString(geoFilter.latLon) &&
      /^[-.0-9]+,\s*[-.0-9]+$/.test(geoFilter.latLon)
    ) {
      tmp = geoFilter.latLon.match(/^([-.0-9]+),\s*([-.0-9]+)$/);
      lat = tmp[2];
      lon = tmp[1];
    }
    // { latLon: "dr5r9ydj2y73"}
    else if (geoFilter.latLon &&
      _.isString(geoFilter.latLon) &&
      /^[0-9a-z]{4,}$/.test(geoFilter.latLon)
    ) {
      tmp = geohash.decode(geoFilter.latLon);
      lat = tmp.latitude;
      lon = tmp.longitude;
    } else if (_.isArray(geoFilter)) {
      lat = geoFilter[0];
      lon = geoFilter[1];
    }

    if (lat !== undefined && lon !== undefined) {
      if (!_.isNumber(lat)) {
        lat = parseFloat(lat);
      }
      if (!_.isNumber(lon)) {
        lon = parseFloat(lon);
      }
    }
    else {
      throw new BadRequestError('Unable to parse coordinates');
    }
    return {lat: lat, lon: lon};
  },

  /**
   * Generate a valid usable distance
   *
   * @param {String} distance the given distance
   * @return {Object} the distance in meters
   */
  getDistance: function (distance) {
    var tmp;
    if (_.isString(distance)) {
      // just clean enough the distance so that localized notations (like "3 258,55 Ft" instead of "3258.55 ft")
      // could be accepted
      tmp = distance.replace(/-/, '').replace(/ /, '').replace(/,/, '.').toLowerCase().replace(/([0-9])([a-z])/, '$1 $2');

      try {
        // units.convert validate the string, so that we do not need further cleanup
        distance = units.convert(tmp + ' to m');
      }
      catch (err) {
        throw new BadRequestError('Unable to parse the distance filter parameter');
      }
    }
    else {
      // nothing else, lets assume that the distance is already in meters
    }

    return distance;
  }
};