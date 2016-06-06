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
      deferred,
      diff = [],
      field,
      formattedFilters;

    if (_.isEmpty(filter)) {
      return q.reject(new BadRequestError('A filter can\'t be empty'));
      return deferred.promise;
    }

    deferred = q.defer();

    field = Object.keys(filter)[0];
    formattedFilters = {};

    async.each(Object.keys(filter[field]), function (rangeOperator, callback) {
      var
        value = filter[field][rangeOperator],
        hashedFunctionName,
        result;

      hashedFunctionName = md5(`${ not && 'not' }${field}${rangeOperator}${value}`);

      result = this.addToFiltersTree(index, collection, field, rangeOperator, value, hashedFunctionName, roomId, not);
      if (util.isError(result)) {
        callback(result);
        return false;
      }

      diff = diff.concat(result.diff);
      formattedFilters[result.path] = result.filter;

      callback();
    }, error => {
      if (error) {
        deferred.reject(error);
      }

      deferred.resolve({diff: diff, filter: {and: formattedFilters}});
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
      diff = [],
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
        .then(response => {
          console.log('GGGGGG', methodName, filter[method]);
          formattedFilters = deepExtend(formattedFilters, response.filter);
          diff = diff.concat(response.diff);
          callback();
        })
        .catch(function (error) {
          callback(error);
        });

    }, error => {
      if (error) {
        deferred.reject(error);
      }

      // check if there is an upper "and" that wrap the whole object
      if ((Object.keys(formattedFilters)[0] !== 'or' && Object.keys(formattedFilters)[0] !== 'and') ||
        Object.keys(formattedFilters).length > 1) {

        formattedFilters = {and: formattedFilters};
      }

      deferred.resolve({ diff: diff, filter: formattedFilters });
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
    return getFormattedFilters(roomId, index, collection, filters, not)
      .then(response => {
        return q({diff: response.diff, filter: {and: response.filters}});
      });
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
  and: this.must,

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
    return getFormattedFiltersAsList(roomId, index, collection, filters, not)
      .then(response => {
        return q({ diff: response.diff, filter: {or: response.filters}});
      });
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
      fieldName,
      formattedFilters,
      hashedFunctionName,
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

    hashedFunctionName = md5(`${not && 'not'}exists${fieldName}`)
    if (not) {
      inGlobals = true;
    }
    result = this.addToFiltersTree(index, collection, fieldName, 'exists', fieldName, hashedFunctionName, roomId, not, inGlobals);
    if (util.isError(result)) {
      return q.reject(result);
    }

    formattedFilters[result.path] = result.filter;

    return q.resolve({ diff: result.diff ? [ result.diff ] : [], filter: formattedFilters });
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
      formattedFilters,
      hashedFunctionName,
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

    hashedFunctionName = md5(`${not && 'not'}ids_id${filter.values}`)

    // We can use the 'terms' operators because is the same behaviour: check if the value in document match one of values in the filter
    result = this.addToFiltersTree(index, collection, '_id', 'terms', filter.values, hashedFunctionName, roomId, not, false);

    if (util.isError(result)) {
      return q.reject(result);
    }

    formattedFilters[result.path] = result.filter;

    return q({ diff: result.diff ? [ result.diff ] : [], filter: formattedFilters });
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
      hashedFunctionName,
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

    hashedFunctionName = md5(`${not && 'not'}${fieldName}geoBoundingBox${geohash.encode(left, top)}${geohash.encode(right, bottom)}`);

    result = this.addToFiltersTree(
      index,
      collection,
      fieldName,
      'geoBoundingBox',
      {top: top, left: left, right: right, bottom: bottom},
      hashedFunctionName,
      roomId,
      not
    );

    if (util.isError(result)) {
      return q.reject(result);
    }

    formattedFilters[result.path] = result.filter;

    return q({ diff: result.diff ? [ result.diff ] : [], filer: formattedFilters });
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
      hashedFunctionName,
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
      return q.reject(err);
    }

    hashedFunctionName = md5(`not${fieldName}geoDistance${geohash.encode(lat, lon)}${distance}`);

    result = this.addToFiltersTree(
      index,
      collection,
      fieldName,
      'geoDistance',
      {lat: lat, lon: lon, distance: distance},
      hashedFunctionName,
      roomId,
      not
    );

    if (util.isError(result)) {
      return q.reject(result);
    }

    formattedFilters[result.path] = result.filter;

    return q({ diff: result.diff ? [ result.diff ] : [], filter: formattedFilters });
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
      hashedFunctionName,
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
      return q.reject(err);
    }

    hashedFunctionName = md5(`${not && 'not'}geoDistanceRange${geohash.encode(lat, lon)}${from}${to}`);

    result = this.addToFiltersTree(
      index,
      collection,
      fieldName,
      'geoDistanceRange',
      {lat: lat, lon: lon, from: from, to: to},
      hashedFunctionName,
      roomId,
      not
    );

    if (util.isError(result)) {
      return q.reject(result);
    }

    formattedFilters[result.path] = result.filter;

    return q({ diff: result.diff ? [ result.diff ] : [], filter: formattedFilters });
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
      hashedFunctionName,
      fieldName,
      formattedFilters = {},
      geoFilter,
      polygon,
      geoHashPolygon = [],
      result;

    if (_.isEmpty(filter)) {
      return q.reject(new BadRequestError('Missing filter'));
    }

    try {

      fieldName = Object.keys(filter)[0];

      geoFilter = filter[fieldName];

      polygon = geoUtil.constructPolygon(geoFilter);

    }
    catch (err) {
      return q.reject(err);
    }

    polygon.forEach(function (point) {
      geoHashPolygon.push(geohash.encode(point.lat, point.lon));
    });

    hashedFunctionName = md5(`${not && 'not'}geoPolygon${geoHashPolygon.join('')}`);

    result = this.addToFiltersTree(
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

    return q({ diff: result.diff ? [ result.diff ] : [], filter: formattedFilters });
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
  regexp: function (roomId, index, collection, filter, not) {
    var
      hashedFunctionName,
      field,
      value,
      result,
      formattedFilter = {},
      regexp,
      flags;

    for (k in filter) {
      if (filter.hasOwnProperty(k)) {
        field = k;
        value = filter[k];
      }
    }
    if (typeof value === 'object') {
      if (value.flags !== undefined) {
        flags = value.flags;
      }
      if (value.value !== undefined) {
        value = value.value;
      }
    }

    try {
      regexp = new RegExp(value, flags);
    }
    catch(err) {
      return q.reject(err);
    }

    hashedFunctionName = md5(`${not && 'not'}regexp${field}${regexp.toString()}`);

    result = this.addToFiltersTree(index, collection, field, 'regexp', regexp.toString(), hashedFunctionName, roomId, not, false);
    if (util.isError(result)) {
      return q.reject(result);
    }

    formattedFilter[result.path] = result.filter;

    return q({ diff: result.diff ? [ result.diff ] : [], filter: formattedFilter });
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
      fieldName,
      formattedFilters,
      hashedFunctionName,
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

    hashedFunctionName = md5(`${not && 'not'}missing${fieldName}`);

    result = this.addToFiltersTree(index, collection, fieldName, 'missing', fieldName, hashedFunctionName, roomId, not, inGlobals);
    if (util.isError(result)) {
      return q.reject(result);
    }

    formattedFilters[result.path] = result.filter;

    return q({ diff: result.diff ? [ result.diff ] : [], filter: formattedFilters});
  },

  addToFiltersTree: addToFiltersTree.bind(this)
};


/**
 * Fill object filtersTree with the new filter added by user
 *
 * @param {String} index the index name
 * @param {String} collection the collection name
 * @param {String} field the field where we need to apply the filter
 * @param {String} operator the operator name that the user wants to execute against the document (defined in operator.js)
 * @param {*} value the value to test on the field
 * @param {String} hashedFunctionName
 * @param {String} roomId
 * @param {Boolean} not
 * @param {Boolean} [inGlobals] true if the roomId must be added in global room for the collection (eg, for 'not exists' filter)
 * @returns {Object} an object with the path and the new filter
 */
function addToFiltersTree(index, collection, field, operator, value, hashedFunctionName, roomId, not, inGlobals) {
  var
    diff,
    changed = false,
    path = index + '.' + collection + '.' + field + '.' + hashedFunctionName;

  diff = {
    ft: {
      i: index,
      c: collection,
      f: field,
      o: operator,
      v: value,
      fn: hashedFunctionName,
      r: roomId,
      n: not,
      g: inGlobals
    }
  };

  if (operators[operator] === undefined) {
    return new BadRequestError(`Operator ${operator} doesn't exist`);
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

  if (!methods.dsl.filtersTree[index][collection].fields[field][hashedFunctionName]) {
    methods.dsl.filtersTree[index][collection].fields[field][hashedFunctionName] = {
      rooms: [],
      args: {operator, not, field, value}
    };
    changed = true;
  }

  if (methods.dsl.filtersTree[index][collection].fields[field][hashedFunctionName].rooms.indexOf(roomId) === -1) {
    methods.dsl.filtersTree[index][collection].fields[field][hashedFunctionName].rooms.push(roomId);
    changed = true;
  }

  if (inGlobals) {
    if (!methods.dsl.filtersTree[index][collection].rooms) {
      methods.dsl.filtersTree[index][collection].rooms = [];
    }

    if (methods.dsl.filtersTree[index][collection].rooms.indexOf(roomId) === -1) {
      methods.dsl.filtersTree[index][collection].rooms.push(roomId);
      changed = true;
    }
  }

  return {
    path: path,
    filter: methods.dsl.filtersTree[index][collection].fields[field][hashedFunctionName],
    diff: changed && diff
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
    diff = [],
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
      .then(response => {
        diff = diff.concat(response.diff);
        formattedFilters = deepExtend(formattedFilters, response.filter);
        callback();
      })
      .catch(function (error) {
        callback(error);
      });

  }, function (error) {
    if (error) {
      deferred.reject(error);
    }

    deferred.resolve({ diff: diff, filter: formattedFilters});
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
    diff = [],
    formattedFilters = [];

  if (!Array.isArray(filters) || filters.length === 0) {
    deferred.reject(new BadRequestError('This filter must contains a filters array'));
    return deferred.promise;
  }


  async.each(filters, (filter, callback) => {
    getFormattedFilters(roomId, index, collection, filter, not)
      .then(response => {
        diff = diff.concat(response.diff);
        formattedFilters.push(response.filter);
        callback();
      })
      .catch(error => {
        callback(error);
      });
  }, error => {
    if (error) {
      return deferred.reject(error);
    }

    return deferred.resolve({ diff, filters: formattedFilters });
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
    hashedFunctionName,
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

  hashedFunctionName = md5(`${ not && 'not' }${termType}${field}${value}`);

  result = addToFiltersTree(index, collection, field, termType, value, hashedFunctionName, roomId, not);
  if (util.isError(result)) {
    return q.reject(result);
  }

  formattedFilters[result.path] = result.filter;

  return q({ diff: result.diff ? [ result.diff ] : [], filter: formattedFilters });
}
