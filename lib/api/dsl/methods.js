var
  _ = require('lodash'),
  async = require('async'),
  operators = require('./operators'),
  q = require('q'),
  geohash = require('ngeohash');

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
      deferred.reject(new Error('A filter can\'t be empty'));
      return deferred.promise;
    }

    field = Object.keys(filter)[0];
    formattedFilters = {};

    async.each(Object.keys(filter[field]), function (fn, callback) {
      var
        value = filter[field][fn],
        curriedFunctionName = '';

      if (not) {
        curriedFunctionName += 'not';
      }
      curriedFunctionName += 'range' + field + fn + value;

      var result = buildCurriedFunction(collection, field, fn, value, curriedFunctionName, roomId, not);
      if (result.error) {
        callback(result.error);
        return false;
      }

      formattedFilters[result.path] = result.filter;

      callback();
    }, function (error) {
      if (error) {
        deferred.reject(new Error(error));
      }

      deferred.resolve({and : formattedFilters});
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
      deferred.reject(new Error('A filter can\'t be empty'));
      return deferred.promise;
    }

    async.each(Object.keys(filter), function (method, callback) {
      var methodName = _.camelCase(method);

      if (this[methodName] === undefined || allowedBoolFunctions.indexOf(methodName) === -1) {
        callback(new Error('Function ' + method + ' doesn\'t exist'));
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

        formattedFilters = { and: formattedFilters };
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
  should: function (roomId, collection, filters, not) {
    var deferred = q.defer();

    getFormattedFilters(roomId, collection, filters, not)
      .then(function (formattedFilters) {
        if (not) {
          deferred.resolve({and: formattedFilters});
        }
        else {
          deferred.resolve({or: formattedFilters});
        }
      })
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
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
    var deferred = q.defer();

    getFormattedFilters(roomId, collection, filters, not)
      .then(function (formattedFilters) {
        deferred.resolve({or: formattedFilters});
      })
      .catch(function (error) {
        deferred.reject(error);
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
      inGlobals = false;

    if (_.isEmpty(filter)) {
      deferred.reject(new Error('A filter can\'t be empty'));
      return deferred.promise;
    }

    fieldName = filter.field;

    if (!fieldName) {
      deferred.reject(new Error('Filter \'exists\' must contains \'field\' attribute'));
      return deferred.promise;
    }

    formattedFilters = {};

    if (not) {
      curriedFunctionName += 'not';
      inGlobals = true;
    }
    // Clean the field in function name because can contains '.' and we don't want it in the function name
    curriedFunctionName += 'exists' + fieldName.split('.').join('');

    var result = buildCurriedFunction(collection, fieldName, 'exists', fieldName, curriedFunctionName, roomId, not, inGlobals);
    if (result.error) {
      deferred.reject(new Error(result.error));
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
      top,
      left,
      bottom,
      right,
      result,
      tmp;

    if (_.isEmpty(filter)) {
      deferred.reject(new Error('Missing filter'));
      return deferred.promise;
    }

    fieldName = Object.keys(filter)[0];

    if (!fieldName || fieldName !== 'location') {
      deferred.reject(new Error('Missing attribute location'));
      return deferred.promise;
    }

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
      // { top: -74.1, left: 40.73, bottom: -71.12, right: 40.01 }
      if (geoFilter.top &&
        geoFilter.left &&
        geoFilter.bottom &&
        geoFilter.right
      ){
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
      ){
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
      ){
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
      ){
        tmp = geoFilter.topLeft.match(/^([-.0-9]+),\s*([-.0-9]+)$/);
        top = tmp[1];
        left = tmp[2];

        tmp = geoFilter.bottomRight.match(/^([-.0-9]+),\s*([-.0-9]+)$/);
        bottom = tmp[1];
        right = tmp[2];
      }
      // { topLeft: "dr5r9ydj2y73", bottomRight: "drj7teegpus6" }
      else if (geoFilter.topLeft &&
        geoFilter.bottomRight &&
        _.isString(geoFilter.topLeft) &&
        _.isString(geoFilter.bottomRight) &&
        /^[0-9a-z]{4,}$/.test(geoFilter.topLeft) &&
        /^[0-9a-z]{4,}$/.test(geoFilter.bottomRight)
      ){
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
        throw new SyntaxError('Unable to parse GeoBoundingBox coordinates');
      }
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

    if (result.error) {
      deferred.reject(new Error(result.error));
      return deferred.promise;
    }

    formattedFilters[result.path] = result.filter;

    deferred.resolve(formattedFilters);
    return deferred.promise;
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
var buildCurriedFunction = function (collection, field, operatorName, value, curriedFunctionName, roomId, not, inGlobals) {
  var
    curriedFunction,
    path = collection+'.'+field+'.'+curriedFunctionName;

  if (operators[operatorName] === undefined) {
    return {error: 'Operator ' + operatorName + ' doesn\'t exist'};
  }

  if (!this.dsl.filtersTree[collection]) {
    this.dsl.filtersTree[collection] = {};
  }

  if (!this.dsl.filtersTree[collection].fields) {
    this.dsl.filtersTree[collection].fields = {};
  }

  if (!this.dsl.filtersTree[collection].fields[field]) {
    this.dsl.filtersTree[collection].fields[field] = {};
  }

  if (!this.dsl.filtersTree[collection].fields[field][curriedFunctionName]) {
    curriedFunction  = _.curry(operators[operatorName]);
    curriedFunction = _.curry(curriedFunction(field, value));
    if (not) {
      curriedFunction = _.negate(curriedFunction);
    }

    this.dsl.filtersTree[collection].fields[field][curriedFunctionName] = {
      rooms: [],
      fn: curriedFunction
    };
  }

  if (this.dsl.filtersTree[collection].fields[field][curriedFunctionName].rooms.indexOf(roomId) === -1) {
    this.dsl.filtersTree[collection].fields[field][curriedFunctionName].rooms.push(roomId);
  }

  if (inGlobals) {
    if (!this.dsl.filtersTree[collection].rooms) {
      this.dsl.filtersTree[collection].rooms = [];
    }

    if (this.dsl.filtersTree[collection].rooms.indexOf(roomId) === -1) {
      this.dsl.filtersTree[collection].rooms.push(roomId);
    }
  }

  return {
    path: path,
    filter: this.dsl.filtersTree[collection].fields[field][curriedFunctionName]
  };
}.bind(methods);

/**
 * Construct the formattedFilters for filters with conditional operand (bool, and, or, ...)
 *
 * @param {String} roomId
 * @param {String} collection
 * @param {Object} filters given by user on subscribe
 * @param {Boolean} not if not is true, invert the boolean result
 * @return {Promise} the formatted filter that need to be added to the room
 */
var getFormattedFilters = function (roomId, collection, filters, not) {
  var
    deferred = q.defer(),
    formattedFilters;

  if (_.isEmpty(filters)) {
    deferred.reject(new Error('Filters can\'t be empty'));
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

    if (this[methodName] === undefined) {
      callback(new Error('Function ' + method + ' doesn\'t exist'));
      return false;
    }

    this[methodName](roomId, collection, filter[method], not)
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

    deferred.resolve(formattedFilters);
  });

  return deferred.promise;
}.bind(methods);

/**
 * Allow to merge two object and merge extend entries "and" and "or"
 * @param {Object} filters1
 * @param {Object} filters2
 * @returns {Object} the merged object
 */
var deepExtend = function (filters1, filters2) {

  if (_.isEmpty(filters1)) {
    return filters2;
  }
  if (_.isEmpty(filters2)) {
    return filters1;
  }

  var
    attr,
    resultFilters = _.clone(filters1);

  for (attr in filters2) {
    if (!resultFilters[attr]) {
      resultFilters[attr] = filters2[attr];
    }
    else {
      if ( attr === 'and' || attr === 'or' ) {
        resultFilters[attr] = deepExtend(resultFilters[attr], filters2[attr]);
      }
    }
  }

  return resultFilters;
};

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
var termFunction = function (termType, roomId, collection, filter, not) {
  var
    deferred = q.defer(),
    field,
    value,
    formattedFilters,
    curriedFunctionName = '';

  if (_.isEmpty(filter)) {
    deferred.reject(new Error('A filter can\'t be empty'));
    return deferred.promise;
  }

  field = Object.keys(filter)[0];
  value = filter[field];
  formattedFilters = {};

  if (termType === 'terms' && !Array.isArray(value)) {
    deferred.reject(new Error('Filter terms must contains an array'));
    return deferred.promise;
  }

  if (not) {
    curriedFunctionName += 'not';
  }
  // Clean the field in function name because can contains '.' and we don't want it in the function name
  curriedFunctionName += termType + field.split('.').join('') + value;

  var result = buildCurriedFunction(collection, field, termType, value, curriedFunctionName, roomId, not);
  if (result.error) {
    deferred.reject(new Error(result.error));
    return deferred.promise;
  }

  formattedFilters[result.path] = result.filter;

  deferred.resolve(formattedFilters);
  return deferred.promise;
};
