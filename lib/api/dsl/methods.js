/**
 * This module parses a filter and populates a FiltersTree instance
 * according to the methods used
 */
var
  _ = require('lodash'),
  async = require('async'),
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  KuzzleError = require('kuzzle-common-objects').Errors.kuzzleError,
  Promise = require('bluebird'),
  util = require('util'),
  geohash = require('ngeohash'),
  geoUtil = require('./geoutil');

/**
 * @property {Filters} filters
 * @param filtersObject
 * @constructor
 */
function Methods(filtersObject) {
  this.filters = filtersObject;

  /**
   * Build rooms and filtersTree according to a given filter for 'equals' filter (test equality)
   *
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} [not] if not is true, check if filters are not true
   * @return {Promise} the formatted filter that need to be added to the room
   */
  this.equals = function (roomId, index, collection, filter, not) {
    return equalsFunction.call(this, 'equals', roomId, index, collection, filter, not);
  };

  /**
   * Build rooms and filtersTree according to a given filter for 'in' filter (test equality with one of given value in array)
   *
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} [not] if not is true, check if filters are not true
   * @return {Promise} the formatted filter that need to be added to the room
   */
  this.in = function (roomId, index, collection, filter, not) {
    return equalsFunction.call(this, 'in', roomId, index, collection, filter, not);
  };

  /**
   * Build filtersTree according to a given filter for 'range' filter and return the formatted filter
   * that can contains filters: gte, gt, lte, lt, from, to
   *
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} [not] if not is true, check if filters are not true
   * @return {Promise} the formatted filter that need to be added to the room
   */
  this.range = function (roomId, index, collection, filter, not) {
    var
      diff = [],
      field,
      formattedFilters;

    if (!filter || Object.keys(filter).length === 0) {
      return Promise.reject(new BadRequestError('A filter can\'t be empty'));
    }

    field = Object.keys(filter)[0];
    formattedFilters = {};

    return new Promise((resolve, reject) => {
      async.each(Object.keys(filter[field]), (rangeOperator, callback) => {
        var
          value = filter[field][rangeOperator],
          encodedFunctionName,
          result;

        encodedFunctionName = `${not ? 'not' : ''}range${field}${rangeOperator}${value}`;

        result = this.filters.add(index, collection, field, rangeOperator, value, encodedFunctionName, roomId, not);
        if (util.isError(result)) {
          callback(result);
          return false;
        }

        diff = diff.concat(result.diff);
        formattedFilters[result.path] = result.filter;

        callback();
      }, error => {
        if (error) {
          return reject(error);
        }

        resolve({diff, filter: {and: formattedFilters}});
      });
    });
  };

  /**
   * Build rooms and filtersTree according to a given filter for 'bool' filter (nested filters with ~and/or)
   *
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} [not] if not is true, check if filters are not true
   * @return {Promise} the formatted filter that need to be added to the room
   */
  this.bool = function (roomId, index, collection, filter, not) {
    var
      allowedBoolFunctions = ['must', 'mustNot', 'should', 'shouldNot'],
      diff = [],
      formattedFilters = {};

    if (!filter || Object.keys(filter).length === 0) {
      return Promise.reject(new BadRequestError('A filter can\'t be empty'));
    }

    return new Promise((resolve, reject) => {
      async.each(Object.keys(filter), (method, callback) => {
        var methodName = _.camelCase(method);

        if (this[methodName] === undefined || allowedBoolFunctions.indexOf(methodName) === -1) {
          return callback(new BadRequestError('Function ' + method + ' doesn\'t exist'));
        }

        this[methodName](roomId, index, collection, filter[method], not)
          .then(response => {
            formattedFilters = deepExtend(formattedFilters, response.filter);
            diff = diff.concat(response.diff);
            callback();
          })
          .catch(error => callback(error));
      }, error => {
        if (error) {
          return reject(error);
        }

        // check if there is an upper "and" that wrap the whole object
        if ((Object.keys(formattedFilters)[0] !== 'or' && Object.keys(formattedFilters)[0] !== 'and') ||
          Object.keys(formattedFilters).length > 1) {

          formattedFilters = {and: formattedFilters};
        }

        resolve({diff, filter: formattedFilters});
      });
    });
  };

  /**
   * Build rooms and filtersTree according to a given filter for 'must' filter (and in nested filters)
   *
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @param {Boolean} [not] if not is true, check if filters are not true
   * @return {Promise} the formatted filter that need to be added to the room
   */
  this.must = function (roomId, index, collection, filters, not) {
    return getFormattedFilters.call(this, roomId, index, collection, filters, not)
      .then(response => ({diff: response.diff, filter: {and: response.filter}}));
  };

  /**
   * Build rooms and filtersTree according to a given filter for 'must_not' filter
   * (and not in nested filters)
   *
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @param {Boolean} [not] if not is true, invert the boolean result
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
   * @param {Boolean} [not] if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  this.should = function (roomId, index, collection, filters, not) {
    return this.or(roomId, index, collection, filters, not);
  };

  /**
   * Build rooms and filtersTree according to a given filter for 'should_not' filter
   * (or in nested filters with a minimum should match option)
   *
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @param {Boolean} [not] if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  this.shouldNot = function (roomId, index, collection, filters, not) {
    if (not === undefined) {
      not = false;
    }

    return this.should(roomId, index, collection, filters, !not);
  };

  /**
   * Build rooms and filtersTree according to a given filter for 'and' filter
   *
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @param {Boolean} [not] if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  this.and = this.must;

  /**
   * Build rooms and filtersTree according to a given filter for 'or' filter
   *
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @param {Boolean} [not] if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  this.or = function (roomId, index, collection, filters, not) {
    return getFormattedFiltersAsList.call(this, roomId, index, collection, filters, not)
      .then(response => ({ diff: response.diff, filter: {or: response.filters}}));
  };

  /**
   * Build rooms and filtersTree according to a given filter for 'not' filter
   *
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filters given by user on subscribe
   * @param {Boolean} [not] if not is true, invert the boolean result
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
   * @param {Boolean} [not] if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  this.exists = function (roomId, index, collection, filter, not) {
    var
      fieldName,
      formattedFilters,
      encodedFunctionName,
      result;

    if (!filter || Object.keys(filter).length === 0) {
      return Promise.reject(new BadRequestError('A filter can\'t be empty'));
    }

    fieldName = filter.field;

    if (!fieldName) {
      return Promise.reject(new BadRequestError('Filter \'exists\' must contains \'field\' attribute'));
    }

    if (typeof fieldName !== 'string') {
      return Promise.reject(new BadRequestError('Filter \'exists\' takes a string attribute. Found: ' + typeof fieldName));
    }

    formattedFilters = {};

    encodedFunctionName = `${not ? 'not': ''}exists${fieldName.replace(/\./g, '')}`;
    result = this.filters.add(index, collection, fieldName, 'exists', fieldName, encodedFunctionName, roomId, not, not);
    if (util.isError(result)) {
      return Promise.reject(result);
    }

    formattedFilters[result.path] = result.filter;

    return Promise.resolve({ diff: result.diff ? [ result.diff ] : [], filter: formattedFilters });
  };

  /**
   * Build rooms and filtersTree according to a given filter for 'ids' filter
   *
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} [not] if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  this.ids = function (roomId, index, collection, filter, not) {
    var
      formattedFilters,
      encodedFunctionName,
      result;

    if (!filter || Object.keys(filter).length === 0) {
      return Promise.reject(new BadRequestError('A filter can\'t be empty'));
    }

    if (!filter.values || Object.keys(filter.values).length === 0) {
      return Promise.reject(new BadRequestError('Filter ids must contains "values" attribute'));
    }

    if (!Array.isArray(filter.values) || filter.values.length === 0) {
      return Promise.reject(new BadRequestError('Attribute "values" in filter ids must contains a non-empty array'));
    }

    formattedFilters = {};

    encodedFunctionName = `${not ? 'not': ''}ids_id${filter.values}`;

    // We can use the 'in' operators because is the same behaviour: check if the value in document match one of values in the filter
    result = this.filters.add(index, collection, '_id', 'in', filter.values, encodedFunctionName, roomId, not, false);

    if (util.isError(result)) {
      return Promise.reject(result);
    }

    formattedFilters[result.path] = result.filter;

    return Promise.resolve({ diff: result.diff ? [ result.diff ] : [], filter: formattedFilters });
  };

  /**
   * Build rooms and filtersTree according to a given filter for 'geoBoundingBox' filter
   *
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} [not] if not is true, invert the boolean result
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

    if (!filter || Object.keys(filter).length === 0) {
      return Promise.reject(new BadRequestError('Missing filter'));
    }

    fieldName = Object.keys(filter)[0];

    geoFilter = filter[fieldName];
    if (geoFilter.top_left) {
      geoFilter.topLeft = geoFilter.top_left;
      delete geoFilter.top_left;
    }
    if (geoFilter.bottom_right) {
      geoFilter.bottomRight = geoFilter.bottom_right;
      delete geoFilter.bottom_right;
    }

    try {
      bBox = geoUtil.constructBBox(geoFilter);
      top = bBox.top;
      left = bBox.left;
      bottom = bBox.bottom;
      right = bBox.right;
    }
    catch (err) {
      return Promise.reject(err);
    }

    encodedFunctionName = `${not ? 'not': ''}${fieldName}geoBoundingBox${geohash.encode(left, top)}${geohash.encode(right, bottom)}`;

    result = this.filters.add(
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
      return Promise.reject(result);
    }

    formattedFilters[result.path] = result.filter;

    return Promise.resolve({ diff: result.diff ? [ result.diff ] : [], filter: formattedFilters });
  };

  /**
   * Return true only if the point in field is in a specific distance from a geo point
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} [not] if not is true, invert the boolean result
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

    if (!filter || Object.keys(filter).length === 0) {
      return Promise.reject(new BadRequestError('Missing filter'));
    }

    fieldName = Object.keys(filter).find(field => field !== 'distance');

    if (fieldName === undefined) {
      return Promise.reject(new BadRequestError('No location field given'));
    }

    geoFilter = filter[fieldName];

    // elastic search DSL allows the undescore notation
    // we need an exception for the linter
    if (geoFilter.lat_lon) {
      geoFilter.latLon = geoFilter.lat_lon;
      delete geoFilter.lat_lon;
    }

    if (!filter.distance) {
      return Promise.reject(new BadRequestError('No distance given'));
    }

    try {
      point = geoUtil.constructPoint(geoFilter);
      lat = point.lat;
      lon = point.lon;
      distance = geoUtil.getDistance(filter.distance);
    }
    catch (err) {
      return Promise.reject(err);
    }

    encodedFunctionName = `${not ? 'not': ''}${fieldName}geoDistance${geohash.encode(lat, lon)}${distance}`;

    result = this.filters.add(
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
      return Promise.reject(result);
    }

    formattedFilters[result.path] = result.filter;

    return Promise.resolve({ diff: result.diff ? [ result.diff ] : [], filter: formattedFilters });
  };

  /**
   * Return true only if the point in field is in a range from a specific point
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} [not] if not is true, invert the boolean result
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

    if (!filter || Object.keys(filter).length === 0) {
      return Promise.reject(new BadRequestError('Missing filter'));
    }

    fieldName = Object.keys(filter).find(field => field !== 'from' && field !== 'to');

    if (fieldName === undefined) {
      return Promise.reject(new BadRequestError('No location field given'));
    }

    geoFilter = filter[fieldName];
    if (geoFilter.lat_lon) {
      geoFilter.latLon = geoFilter.lat_lon;
      delete geoFilter.lat_lon;
    }

    if (!filter.from) {
      return Promise.reject(new BadRequestError('No from parameter given'));
    }
    if (!filter.to) {
      return Promise.reject(new BadRequestError('No to parameter given'));
    }

    try {
      point = geoUtil.constructPoint(geoFilter);
      lat = point.lat;
      lon = point.lon;

      from = geoUtil.getDistance(filter.from);
      to = geoUtil.getDistance(filter.to);
    }
    catch (err) {
      return Promise.reject(err);
    }

    encodedFunctionName = `${not ? 'not': ''}${fieldName}geoDistanceRange${geohash.encode(lat, lon)}${from}${to}`;

    result = this.filters.add(
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
      return Promise.reject(result);
    }

    formattedFilters[result.path] = result.filter;

    return Promise.resolve({ diff: result.diff ? [ result.diff ] : [], filter: formattedFilters });
  };

  /**
   * Return true only if the point in field is included in a polygon
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} [not] if not is true, invert the boolean result
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

    if (!filter || Object.keys(filter).length === 0) {
      return Promise.reject(new BadRequestError('Missing filter'));
    }

    fieldName = Object.keys(filter)[0];
    geoFilter = filter[fieldName];

    try {
      polygon = geoUtil.constructPolygon(geoFilter);
    }
    catch (err) {
      return Promise.reject(err);
    }

    polygon.forEach(point => geoHashPolygon.push(geohash.encode(point.lat, point.lon)));

    encodedFunctionName = `${not ? 'not': ''}${fieldName}geoPolygon${geoHashPolygon.join('')}`;

    result = this.filters.add(
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
      return Promise.reject(result);
    }

    formattedFilters[result.path] = result.filter;

    return Promise.resolve({ diff: result.diff ? [ result.diff ] : [], filter: formattedFilters });
  };

  /**
   * Return true only if the point in field is in the square
   */
  this.geoShape = function () {
    return Promise.reject(new KuzzleError('geoShape is not implemented yet.'));
  };

  /**
   * Return true only if the value in field pass the regexp test
   */
  this.regexp = function (roomId, index, collection, filter, not) {
    var
      encodedFunctionName,
      field,
      value,
      result,
      regexp,
      flags;

    if (typeof filter !== 'object') {
      return Promise.reject(new BadRequestError('Regexp argument must be an object'));
    }
    
    if (Object.keys(filter).length !== 1) {
      return Promise.reject(new BadRequestError('Regexp can take only one field entry'));
    }
    
    field = Object.keys(filter)[0];
    value = filter[field];

    if (typeof value === 'object') {
      if (value.flags !== undefined) {
        flags = value.flags;
      }
      if (value.value !== undefined) {
        value = value.value;
      }
      else {
        return Promise.reject(new BadRequestError('Missing regexp value'));
      }
    }

    try {
      regexp = new RegExp(value, flags);
    }
    catch (err) {
      return Promise.reject(err);
    }

    encodedFunctionName = `${not ? 'not': ''}regexp${field}${regexp.toString()}`;

    result = this.filters.add(index, collection, field, 'regexp', regexp.toString(), encodedFunctionName, roomId, not, false);
    if (util.isError(result)) {
      return Promise.reject(result);
    }

    return Promise.resolve({ diff: result.diff ? [ result.diff ] : [], filter: {[result.path]: result.filter}});
  };

  /**
   * Build rooms and filtersTree according to a given filter for 'missing' filter
   *
   * @param {String} roomId
   * @param {String} index
   * @param {String} collection
   * @param {Object} filter given by user on subscribe
   * @param {Boolean} [not] if not is true, invert the boolean result
   * @return {Promise} the formatted filter that need to be added to the room
   */
  this.missing = function (roomId, index, collection, filter, not) {
    var
      fieldName,
      formattedFilters,
      encodedFunctionName,
      result;

    if (!filter || Object.keys(filter).length === 0) {
      return Promise.reject(new BadRequestError('A filter can\'t be empty'));
    }

    fieldName = filter.field;

    if (!fieldName) {
      return Promise.reject(new BadRequestError('Filter \'missing\' must contains \'field\' attribute'));
    }

    formattedFilters = {};

    encodedFunctionName = `${not ? 'not': ''}missing${fieldName.replace(/\./g, '')}`;

    result = this.filters.add(index, collection, fieldName, 'missing', fieldName, encodedFunctionName, roomId, not, not);
    if (util.isError(result)) {
      return Promise.reject(result);
    }

    formattedFilters[result.path] = result.filter;

    return Promise.resolve({ diff: result.diff ? [ result.diff ] : [], filter: formattedFilters});
  };
}


/**
 * Construct the formattedFilters for filters with conditional operand (bool, and, or, ...)
 *
 * @param {String} roomId
 * @param {String} index
 * @param {String} collection
 * @param {Object} filters given by user on subscribe
 * @param {Boolean} [not] if not is true, invert the boolean result
 * @return {Promise} the formatted filter that need to be added to the room
 */
function getFormattedFilters(roomId, index, collection, filters, not) {
  var
    diff = [],
    formattedFilters;

  if (!filters || Object.keys(filters).length === 0) {
    return Promise.reject(new BadRequestError('Filters can\'t be empty'));
  }

  formattedFilters = {};

  if (!Array.isArray(filters)) {
    filters = [filters];
  }

  return new Promise((resolve, reject) => {
    async.each(filters, (filter, callback) => {
      var
        method,
        methodName;

      if (Object.keys(filter).length === 0) {
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

      this[methodName](roomId, index, collection, filter[method], not)
        .then(response => {
          diff = diff.concat(response.diff);
          formattedFilters = deepExtend(formattedFilters, response.filter);
          callback();
        })
        .catch(error => {
          callback(error);
        });

    }, (error) => {
      if (error) {
        return reject(error);
      }

      resolve({diff: diff, filter: formattedFilters});
    });
  });
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
    diff = [],
    formattedFilters = [];

  if (!Array.isArray(filters) || filters.length === 0) {
    return Promise.reject(new BadRequestError('This filter must contains a filters array'));
  }

  return new Promise((resolve, reject) => {
    async.each(filters, (filter, callback) => {
      getFormattedFilters.call(this, roomId, index, collection, filter, not)
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
        return reject(error);
      }

      resolve({diff, filters: formattedFilters});
    });
  });
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

  if (!filters1 || Object.keys(filters1).length === 0) {
    return filters2;
  }
  if (!filters2 || Object.keys(filters2).length === 0) {
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
 * Allow to build filter for "equals" and "in" filters
 *
 * @param {String} keyword "equals" or "in"
 * @param {String} roomId
 * @param {String} index
 * @param {String} collection
 * @param {Object} filter given by user on subscribe
 * @param {Boolean} not if not is true, check if filters are not true
 * @return {Promise} the formatted filter that need to be added to the room
 */
function equalsFunction(keyword, roomId, index, collection, filter, not) {
  var
    field,
    value,
    formattedFilters,
    encodedFunctionName,
    result;

  if (!filter || Object.keys(filter).length === 0) {
    return Promise.reject(new BadRequestError('A filter can\'t be empty'));
  }

  field = Object.keys(filter)[0];
  value = filter[field];
  formattedFilters = {};

  if (keyword === 'in' && !Array.isArray(value)) {
    return Promise.reject(new BadRequestError('Filter in must contains an array'));
  }

  encodedFunctionName = `${not ? 'not': ''}${keyword}${field.replace(/\./g, '')}${value}`;

  result = this.filters.add(index, collection, field, keyword, value, encodedFunctionName, roomId, not);
  if (util.isError(result)) {
    return Promise.reject(result);
  }

  formattedFilters[result.path] = result.filter;

  return Promise.resolve({ diff: result.diff ? [ result.diff ] : [], filter: formattedFilters });
}

module.exports = Methods;
