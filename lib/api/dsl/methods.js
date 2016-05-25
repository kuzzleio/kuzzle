var
  _ = require('lodash'),
  async = require('async'),
  operators = require('./operators'),
  BadRequestError = require('../core/errors/badRequestError'),
  KuzzleError = require('../core/errors/kuzzleError'),
  q = require('q'),
  util = require('util'),
  geohash = require('ngeohash'),
  geoUtil = require('./geoutil'),
  md5 = require('crypto-md5'),
  methods;

module.exports = methods = {

  /**
   * Reference to parent. Initialized by the Dsl object
   */
  dsl: {},

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
  term: function (roomId, index, collection, filter, not) {
    return termFunction('term', roomId, index, collection, filter, not);
  },

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
  terms: function (roomId, index, collection, filter, not) {
    return termFunction('terms', roomId, index, collection, filter, not);
  },

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
  range: function (roomId, index, collection, filter, not) {
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

      result = buildCurriedFunction(index, collection, field, fn, value, curriedFunctionName, roomId, not);
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
   * @param {String} index
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, check if filters are not true
   * @return {Promise} the formatted filter that need to be added to the room
   */
  bool: function (roomId, index, collection, filter, not) {
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

      this[methodName](roomId, index, collection, filter[method], not)
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
   * @param {String} index
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @param {Boolean} not if not is true, check if filters are not true
   * @return {Promise} the formatted filter that need to be added to the room
   */
  must: function (roomId, index, collection, filters, not) {
    var deferred = q.defer();

    getFormattedFilters(roomId, index, collection, filters, not)
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
   * @param {String} index
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  mustNot: function (roomId, index, collection, filters, not) {
    if (not === undefined) {
      not = false;
    }

    return this.must(roomId, index, collection, filters, !not);
  },

  /**
   * Build rooms and filtersTree according to a given filter for 'should' filter (or in nested filters with a minimum should match option)
   *
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  should: function (roomId, index, collection, filters, not) {
    if (not) {
      return this.and(roomId, index, collection, filters, not);
    }

    return this.or(roomId, index, collection, filters, not);
  },

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
  and: function (roomId, index, collection, filters, not) {
    var deferred = q.defer();

    getFormattedFilters(roomId, index, collection, filters, not)
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
   * @param {String} index
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  or: function (roomId, index, collection, filters, not) {
    var
      deferred = q.defer();

    getFormattedFiltersAsList(roomId, index, collection, filters, not)
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
   * @param {String} index
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  not: function (roomId, index, collection, filters, not) {
    if (not === undefined) {
      not = false;
    }

    return this.must(roomId, index, collection, filters, !not);
  },

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
  exists: function (roomId, index, collection, filter, not) {
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

    result = buildCurriedFunction(index, collection, fieldName, 'exists', fieldName, curriedFunctionName, roomId, not, inGlobals);
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
   * @param {String} index
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  ids: function (roomId, index, collection, filter, not) {
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
    result = buildCurriedFunction(index, collection, '_id', 'terms', filter.values, curriedFunctionName, roomId, not, false);

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
   * @param {String} index
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  geoBoundingBox: function (roomId, index, collection, filter, not) {
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
      index,
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
   * @param {String} index
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  geoDistance: function (roomId, index, collection, filter, not) {
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
      index,
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
   * @param {String} index
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  geoDistanceRange: function (roomId, index, collection, filter, not) {
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
      index,
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
   * @param {String} index
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  geoPolygon: function (roomId, index, collection, filter, not) {
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
      index,
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
   * @param {String} index
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} not if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  missing: function (roomId, index, collection, filter, not) {
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

    result = buildCurriedFunction(index, collection, fieldName, 'missing', fieldName, curriedFunctionName, roomId, not, inGlobals);
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
 * @param {String} index the index name
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
function buildCurriedFunction(index, collection, field, operatorName, value, curriedFunctionName, roomId, not, inGlobals) {
  var
    curriedFunction,
    fnSource,
    path;

  curriedFunctionName = md5(curriedFunctionName);
  path = index + '.' + collection + '.' + field + '.' + curriedFunctionName;

  if (operators[operatorName] === undefined) {
    return new BadRequestError('Operator ' + operatorName + ' doesn\'t exist');
  }

  if (!methods.dsl.filtersTree[index]) {
    methods.dsl.filtersTree[index] = {};
  }

  if (!methods.dsl.filtersTree[index][collection]) {
    methods.dsl.filtersTree[index][collection] = {};
  }

  if (!methods.dsl.filtersTree[index][collection].fields) {
    methods.dsl.filtersTree[index][collection].fields = {};
  }

  if (!methods.dsl.filtersTree[index][collection].fields[field]) {
    methods.dsl.filtersTree[index][collection].fields[field] = {};
  }

  if (!methods.dsl.filtersTree[index][collection].fields[field][curriedFunctionName]) {
    // we need the ugly eval code to make sure the function can later on be serialized and
    // reused without having to keep a closure context in memory
    /* eslint-disable no-eval */
    fnSource = 'd => ' + (not ? '!' : '') + `operators['${operatorName}'](${JSON.stringify(field)}, ${JSON.stringify(value)}, d);`;
    curriedFunction = eval(fnSource);
    /* eslint-enable no-eval */

    methods.dsl.filtersTree[index][collection].fields[field][curriedFunctionName] = {
      rooms: [],
      fn: curriedFunction
    };
  }

  if (methods.dsl.filtersTree[index][collection].fields[field][curriedFunctionName].rooms.indexOf(roomId) === -1) {
    methods.dsl.filtersTree[index][collection].fields[field][curriedFunctionName].rooms.push(roomId);
  }

  if (inGlobals) {
    if (!methods.dsl.filtersTree[index][collection].rooms) {
      methods.dsl.filtersTree[index][collection].rooms = [];
    }

    if (methods.dsl.filtersTree[index][collection].rooms.indexOf(roomId) === -1) {
      methods.dsl.filtersTree[index][collection].rooms.push(roomId);
    }
  }

  return {
    path: path,
    filter: methods.dsl.filtersTree[index][collection].fields[field][curriedFunctionName]
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

    methods[methodName](roomId, index, collection, filter[method], not)
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
    getFormattedFilters(roomId, index, collection, filter, not)
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

  result = buildCurriedFunction(index, collection, field, termType, value, curriedFunctionName, roomId, not);
  if (util.isError(result)) {
    deferred.reject(result);
    return deferred.promise;
  }

  formattedFilters[result.path] = result.filter;

  deferred.resolve(formattedFilters);
  return deferred.promise;
}
