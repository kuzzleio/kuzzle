var
  Promise = require('bluebird'),
  geohash = require('ngeohash'),
  units = require('node-units'),
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError;

/**
 * Verifies that a subscription is well-formed, and
 * rewrites parts of filters to harmonize filter variants
 * so that every filters use the same syntax
 *
 * Does not mutate the input filters.
 *
 * @constructor
 */
function Standardizer () {
  var self = this;

  this.dsl = {};

  /**
   * Standardization entry point
   *
   * @param {Object} filters
   * @returns {Promise} resolving to a standardized version of provided filters
   */
  this.standardize = function (filters) {
    var
      keywords;

    keywords = filters ? Object.keys(filters) : [];

    if (keywords.length === 0) {
      return Promise.resolve({});
    }

    if (keywords.length > 1) {
      return Promise.reject(new BadRequestError('Invalid filter syntax'));
    }

    if (!self.dsl[keywords[0]]) {
      return Promise.reject(new BadRequestError(`Unknown DSL keyword: ${keywords[0]}`));
    }

    return self.dsl[keywords[0]](filters);
  };


  /**
   * Validate a "exists" keyword
   *
   * @param filter
   * @param [name] - optional keyword name to use. Defaults to 'exists'
   * @returns {Promise} standardized filter
   */
  this.dsl.exists = function (filter, name) {
    name = name || 'exists';

    return mustBeNonEmptyObject(filter[name], name)
      .then(() => mustBeString(filter[name], name, 'field'))
      .then(() => filter);
  };

  /**
   * Validate a "ids" keyword and converts it
   * into a series of "term" conditions
   *
   * @param filter
   * @returns {Promise} standardized filter
   */
  this.dsl.ids = function (filter) {
    return mustBeNonEmptyObject(filter.ids, 'ids')
      .then(() => requireAttribute(filter.ids, 'ids', 'values'))
      .then(() => mustBeNonEmptyArray(filter.ids, 'ids', 'values'))
      .then(() => {
        if (filter.ids.values.findIndex(v => typeof v !== 'string') > -1) {
          return Promise.reject(new BadRequestError('Array "values" in keyword "ids" can only contain strings'));
        }

        return {or: filter.ids.values.map(v => ({equals: {_id: v}}))};
      });
  };

  /**
   * Validate a "missing" keyword
   * @param filter
   * @returns {Promise} standardized filter
   */
  this.dsl.missing = function (filter) {
    return self.dsl.exists(filter, 'missing')
      .then(f => ({not: {exists: {field: f.missing.field}}}));
  };

  /**
   * Validate a "range" keyword
   * @param filter
   * @returns {Promise} standardized filter
   */
  this.dsl.range = function (filter) {
    var rangeField;

    return mustBeNonEmptyObject(filter.range, 'range')
      .then(field => onlyOneFieldAttribute(field, 'range'))
      .then(field => {
        rangeField = field[0];
        return mustBeNonEmptyObject(filter.range[rangeField], `range.${rangeField}`);
      })
      .then(rangeValues => {
        var
          index = rangeValues.findIndex(v => ['gt', 'lt', 'gte', 'lte'].indexOf(v) === -1),
          high = Infinity,
          low = -Infinity,
          error = null;

        if (index > -1) {
          return Promise.reject(new BadRequestError(`"range.${rangeField}" accepts only the following attributes : gt, gte, lt, lte`));
        }

        index = rangeValues.findIndex(v => typeof filter.range[rangeField][v] !== 'number');

        if (index > -1) {
          return Promise.reject(new BadRequestError(`"range.${rangeField}.${rangeValues[index]}" must be a number`));
        }

        rangeValues.forEach(rangeType => {
          if (rangeType.startsWith('lt')) {
            if (high !== Infinity) {
              error = new BadRequestError(`"range.${rangeField}:" only 1 upper boundary allowed`);
            }
            else {
              high = filter.range[rangeField][rangeType];
            }
          }

          if (rangeType.startsWith('gt')) {
            if (low !== -Infinity) {
              error = new BadRequestError(`"range.${rangeField}:" only 1 lower boundary allowed`);
            }
            else {
              low = filter.range[rangeField][rangeType];
            }
          }
        });

        if (error) {
          return Promise.reject(error);
        }

        if (high <= low) {
          return Promise.reject(new BadRequestError(`"range.${rangeField}:" lower boundary must be strictly inferior to the upper one`));
        }

        return filter;
      });
  };

  /**
   * Validate a "regexp" keyword
   * @param filter
   * @returns {Promise} standardized filter
   */
  this.dsl.regexp = function (filter) {
    var regexpField;

    return mustBeNonEmptyObject(filter.regexp, 'regexp')
      .then(field => onlyOneFieldAttribute(field, 'regexp'))
      .then(field => {
        regexpField = field[0];
        return mustBeNonEmptyObject(filter.regexp[regexpField], `regexp.${regexpField}`);
      })
      .then(regexpValues => {
        if (regexpValues.findIndex(v => ['flags', 'value'].indexOf(v) === -1) !== -1) {
          return Promise.reject(new BadRequestError('Keyword "regexp" can only contain the following attributes: flags, value'));
        }

        return requireAttribute(filter.regexp[regexpField], 'regexp', 'value');
      })
      .then(() => {
        if (filter.regexp[regexpField].flags) {
          return mustBeString(filter.regexp[regexpField], 'regexp', 'flags');
        }

        return Promise.resolve();
      })
      .then(() => filter);
  };

  /**
   * Validate a "equals" keyword
   * @param filter
   * @returns {Promise} standardized filter
   */
  this.dsl.equals = function (filter) {
    return mustBeNonEmptyObject(filter.equals, 'equals')
      .then(field => onlyOneFieldAttribute(field, 'equals'))
      .then(field => mustBeString(filter.equals, 'equals', field[0]))
      .then(() => filter);
  };

  /**
   * Validate a "in" keyword and converts it into a series
   * of "equals" conditions
   * @param filter
   * @returns {Promise} standardized filter
   */
  this.dsl.in = function (filter) {
    var inValue;

    return mustBeNonEmptyObject(filter.in, 'in')
      .then(field => onlyOneFieldAttribute(field, 'in'))
      .then(field => {
        inValue = field[0];
        return mustBeNonEmptyArray(filter.in, 'in', inValue);
      })
      .then(() => {
        if (filter.in[inValue].findIndex(v => typeof v !== 'string') > -1) {
          return Promise.reject(new BadRequestError(`Array "${inValue}" in keyword "in" can only contain strings`));
        }

        return {or: filter.in[inValue].map(v => ({equals: {[inValue]: v}}))};
      });
  };

  /**
   * Validate a "geoBoundingBox" keyword
   * @param filter
   * @returns {Promise} standardized filter
   */
  this.dsl.geoBoundingBox = function (filter) {
    return mustBeNonEmptyObject(filter.geoBoundingBox, 'geoBoundingBox')
      .then(field => onlyOneFieldAttribute(field, 'geoBoundingBox'))
      .then(field => {
        var
          bBox = geoLocationToCamelCase(filter.geoBoundingBox[field[0]]),
          standardized = {},
          tmp,
          regex;

        /*
         * Multiple geopoint formats are accepted
         * We verify that the provided geopoint matches one of the
         * support format, and we convert it to a standardized
         * geopoint for further uses
         */

        // { top: -74.1, left: 40.73, bottom: -71.12, right: 40.01 }
        if (fieldsExist(bBox, ['top', 'left', 'bottom', 'right'], 'number')) {
          ['top', 'left', 'bBox', 'right'].forEach(v => {
            standardized[v] = bBox[v];
          });
        }

        // { topLeft: { lat: 40.73, lon: -74.1 }, bottomRight: { lat: 40.01, lon: -71.12 } }
        if (!standardized.top &&
          fieldsExist(bBox, ['bottomRight', 'topLeft'], 'object') &&
          fieldsExist(bBox.bottomRight, ['lat', 'lon'], 'number') &&
          fieldsExist(bBox.topLeft, ['lat', 'lon'], 'number')) {
          standardized = {
            top: bBox.topLeft.lon,
            left: bBox.topLeft.lat,
            bottom: bBox.bottomRight.lon,
            right: bBox.bottomRight.lat
          };
        }

        // { topLeft: [ -74.1, 40.73 ], bottomRight: [ -71.12, 40.01 ] }
        if (!standardized.top &&
          fieldsExist(bBox, ['bottomRight', 'topLeft'], 'object') &&
          Array.isArray(bBox.bottomRight) &&
          Array.isArray(bBox.topLeft) &&
          bBox.bottomRight.length === 2 &&
          bBox.topLeft.length === 2 &&
          bBox.bottomRight.every(v => typeof v === 'number') &&
          bBox.topLeft.every(v => typeof v === 'number')) {
          standardized = {
            top: bBox.topLeft[0],
            left: bBox.topLeft[1],
            bottom: bBox.bottomRight[0],
            right: bBox.bottomRight[1]
          };
        }

        // { topLeft: "40.73, -74.1", bottomRight: "40.01, -71.12" }
        if (!standardized.top) {
          regex = /^[-.0-9]+,\s*[-.0-9]+$/;

          if (fieldsExist(bBox, ['bottomRight', 'topLeft'], 'string', regex)) {
            tmp = bBox.topLeft.match(regex);
            standardized.top = tmp[2];
            standardized.left = tmp[1];

            tmp = bBox.bottomRight.match(regex);
            standardized.bottom = tmp[2];
            standardized.right = tmp[1];
          }
        }

        // { topLeft: "dr5r9ydj2y73", bottomRight: "drj7teegpus6" }
        if (!standardized.top && fieldsExist(bBox, ['bottomRight', 'topLeft'], 'string', /^[0-9a-z]{4,}$/)) {
          tmp = geohash.decode(bBox.topLeft);
          standardized.top = tmp.longitude;
          standardized.left = tmp.latitude;

          tmp = geohash.decode(bBox.bottomRight);
          standardized.bottom = tmp.longitude;
          standardized.right = tmp.latitude;
        }

        if (!standardized.top) {
          return Promise.reject(new BadRequestError(`Unrecognized geo-point format in "geoBoundingBox.${field[0]}`));
        }

        return {geoBoundingBox: {[field[0]]: standardized}};
      });
  };

  /**
   * Validate a "geoDistance" keyword
   * @param filter
   * @returns {Promise} standardized filter
   */
  this.dsl.geoDistance = function (filter) {
    var
      docField,
      standardized = {geoDistance: {}};

    return mustBeNonEmptyObject(filter.geoDistance, 'geoDistance')
      .then(fields => {

        if (fields.length !== 2 || !fields.distance) {
          return Promise.reject(new BadRequestError('"geoDistance" keyword requires a document field and a "distance" attribute'));
        }

        return mustBeString(filter.geoDistance, 'geoDistance', 'distance');
      })
      .then(() => {
        docField = Object.keys(filter.geoDistance).find(f => f !== 'distance');

        return convertGeopoint(geoLocationToCamelCase(filter.geoDistance[docField]), 'geoDistance');
      })
      .then(point => {
        standardized.geoDistance[docField] = point;
        return convertDistance(filter.geoDistance.distance, 'geoDistance');
      })
      .then(distance => {
        standardized.geoDistance.distance = distance;
        return standardized;
      });
  };

  /**
   * Validate a "geoDistanceRange" keyword
   * @param filter
   * @returns {Promise} standardized filter
   */
  this.dsl.geoDistanceRange = function (filter) {
    var
      docField,
      standardized = {geoDistanceRange: {}};

    return mustBeNonEmptyObject(filter.geoDistanceRange, 'geoDistanceRange')
      .then(fields => {
        if (fields.length !== 3 || !fields.from || !fields.to) {
          return Promise.reject(new BadRequestError('"geoDistanceRange" keyword requires a document field and the following attributes: "from", "to"'));
        }

        docField = Object.keys(filter.geoDistanceRange).find(f => f !== 'from' && f !== 'to');
        return mustBeString(filter.geoDistanceRange, 'geoDistanceRange', 'from');
      })
      .then(() => mustBeString(filter.geoDistanceRange, 'geoDistanceRange', 'to'))
      .then(() => convertGeopoint(geoLocationToCamelCase(filter.geoDistanceRange[docField]), 'geoDistanceRange'))
      .then(point => {
        standardized.geoDistanceRange[docField] = point;
        return convertDistance(filter.geoDistanceRange.from, 'geoDistanceRange');
      })
      .then(distance => {
        standardized.geoDistanceRange.from = distance;
        return convertDistance(filter.geoDistanceRange.to, 'geoDistanceRange');
      })
      .then(distance => {
        standardized.geoDistanceRange.to = distance;
        return standardized;
      });
  };

  /**
   * Validate a "geoPolygon" keyword
   * @param filter
   * @returns {Promise} standardized filter
   */
  this.dsl.geoPolygon = function (filter) {
    var
      docField,
      points = [];

    return mustBeNonEmptyObject(filter.geoPolygon, 'geoPolygon')
      .then(fields => onlyOneFieldAttribute(fields, 'geoBoundingBox'))
      .then(fields => {
        docField = fields[0];
        return requireAttribute(filter.geoPolygon[docField], `geoPolygon.${docField}`, 'points');
      })
      .then(() => mustBeNonEmptyArray(filter.geoPolygon[docField], `geoPolygon.${docField}`, 'points'))
      .then(() => {
        var promises;

        if (filter.geoPolygon[docField].points.length < 3) {
          return Promise.reject(new BadRequestError(`"geoPolygon.${docField}": at least 3 points are required to build a polygon`));
        }

        promises = filter.geoPolygon[docField].points.map(p => {
          return convertGeopoint(p, 'geoPolygon').then(point => points.push(point));
        });

        return Promise.all(promises);
      })
      .then(() => ({geoPolygon: {[docField]: points}}));
  };

  /**
   * Validates a AND-like operand
   * @param {Object} filter
   * @param {string} operand name - used by AND, MUST and MUST_NOT operands
   * @returns {Promise} standardized filter
   */
  this.dsl.and = function (filter, operand) {
    operand = operand || 'and';
    return mustBeNonEmptyArray(filter, operand, operand)
      .then(() => standardizeFilterArray(self.standardize, filter[operand], operand))
      .then(standardized => ({[operand]: standardized}));
  };

  /**
   * Validates a OR-like operand
   * @param {Object} filter
   * @param {string} operand name - used by OR, SHOULD and SHOULD_NOT operands
   * @returns {Promise} standardized filter
   */
  this.dsl.or = function (filter, operand) {
    operand = operand || 'or';
    return mustBeNonEmptyArray(filter, operand, operand)
      .then(() => standardizeFilterArray(self.standardize, filter[operand], operand))
      .then(standardized => ({[operand]: standardized}));
  };

  /**
   * Validates a NOT operand
   * @param filter
   * @returns {Promise} standardized filter
   */
  this.dsl.not = function (filter) {
    var kwd;

    return mustBeNonEmptyObject(filter.not, 'not')
      .then(fields => onlyOneFieldAttribute(fields, 'not'))
      .then(fields => {
        kwd = fields[0];
        return mustBeNonEmptyObject(filter.not[kwd], `not.${kwd}`);
      })
      .then(() => self.standardize(filter.not))
      .then(result => {
        return {not: result};
      });
  };

  /**
   * Validates a BOOL operand
   * @param filter
   * @returns {Promise} standardized filter
   */
  this.dsl.bool = function (filter) {
    var
      attributes = ['must', 'must_not', 'should', 'should_not'],
      standardized = {and: []};

    return mustBeNonEmptyObject(filter.bool, 'bool')
      .then(fields => {
        // the only accepted attributes are: must, must_not, should, should_not
        if (fields.findIndex(f => attributes.indexOf(f) === -1) > -1) {
          return Promise.reject('"bool" operand accepts only the following attributes: ' + attributes.join(', '));
        }

        return filter.bool.must ? self.dsl.and(filter.bool, 'must') : Promise.resolve(null);
      })
      .then(f => {
        f && standardized.and.push({and: f.must});
        return filter.bool.must_not ? self.dsl.and(filter.bool, 'must_not') : Promise.resolve(null);
      })
      .then(f => {
        f && standardized.and.push({not: {and: f.must_not}});
        return filter.bool.should ? self.dsl.or(filter.bool, 'should') : Promise.resolve(null);
      })
      .then(f => {
        f && standardized.and.push({or: f.should});
        return filter.bool.should_not ? self.dsl.or(filter.bool, 'should_not') : Promise.resolve(null);
      })
      .then(f => {
        f && standardized.and.push({not: {or: f.should_not}});
        return standardized;
      });
  };

  return this;
}

/**
 * Checks that a filters array is well-formed and standardized it
 *
 * @param {Function} standardize function
 * @param {Array} filters array
 * @param {string} keyword used to combine filters
 * @returns {Promise}
 */
function standardizeFilterArray (standardize, filters, keyword) {
  var idx;

  // All registered items must be non-array, non-empty objects
  idx = Object.keys(filters).findIndex(v => {
    return typeof filters[v] !== 'object' ||
      Array.isArray(filters[v]) ||
      Object.keys(filters[v]).length === 0;
  });

  if (idx > -1) {
    return Promise.reject(`"${keyword}" operand can only contain non-empty objects`);
  }

  return Promise.reduce(filters.map(v => standardize(v)), (standardized, item) => {
    standardized.push(item);
    return standardized;
  }, []);
}

/**
 * Converts known geolocation fields from snake_case to camelCase
 * Other fields are copied without change
 *
 * @param {Object} obj - object containing geolocation fields
 * @returns {Object} new object with converted fields
 */
function geoLocationToCamelCase (obj) {
  var
    converted = {};

  Object.keys(obj).forEach(k => {
    var
      idx = ['lat_lon', 'top_left', 'bottom_right'].indexOf(k);

    if (idx === -1) {
      converted[k] = obj[k];
    }
    else {
      converted[k
        .split('_')
        .map((v, i) => i === 0 ? v : v.charAt(0).toUpperCase() + v.substring(1))
        .join('')] = obj[k];
    }
  });

  return converted;
}

/**
 * Converts one of the accepted geopoint format into
 * a standardized version
 *
 * @param {Object} obj - object containing a geopoint
 * @param {string} keyword - name of the tested DSL keyword
 * @returns {Promise} resolving to a standardized geopoint or failing if no accepted format is found
 */
function convertGeopoint (obj, keyword) {
  var
    point = {},
    regex,
    tmp;

  // { lat: -74.1, lon: 40.73 }
  if (fieldsExist(obj, ['lat', 'lon'], 'number')) {
    point = obj;
  }

  // { latLon: { lat: 40.73, lon: -74.1 } }
  if (!point.lat &&
    obj.latLon &&
    typeof obj.latLon === 'object' &&
    !Array.isArray(obj.latLon) &&
    fieldsExist(obj.latLon, ['lat', 'lon'], 'number')) {
    point = obj.latLon;
  }

  // { latLon: [ -74.1, 40.73 ] }
  if (!point.lat && obj.latLon && Array.isArray(obj.latLon) && obj.latLon.length === 2) {
    point.lat = obj.latLon[0];
    point.lon = obj.latLon[1];
  }

  if (!point.lat && obj.latLon && typeof obj.latLon === 'string') {
    // { latLon: "40.73, -74.1" }
    regex = /^[-.0-9]+,\s*[-.0-9]+$/;
    if (regex.test(obj.latLon)) {
      tmp = obj.latLon.match(regex);
      point.lat = tmp[2];
      point.lon = tmp[1];
    }

    // { latLon: "dr5r9ydj2y73"}
    regex = /^[0-9a-z]{4,}$/;
    if (regex.test(obj.latLon)) {
      tmp = geohash.decode(obj.latLon);
      point.lat = tmp.latitude;
      point.lon = tmp.longitude;
    }
  }

  if (!point.lat) {
    return Promise.reject(new BadRequestError(`"${keyword}": unrecognized geopoint format`));
  }

  return Promise.resolve(point);
}

/**
 * Converts a distance string value to a number of meters
 * @param {string} distance - client-provided distance
 * @param {string} keyword - name of the tested DSL keyword
 * @returns {Promise} resolves to converted distance
 */
function convertDistance (distance, keyword) {
  var cleaned, converted;

  // clean up to ensure node-units will be able to convert it
  // for instance: "3 258,55 Ft" => "3258.55 ft"
  cleaned = distance
    .replace(/[-\s]/g, '')
    .replace(/,/g, '.')
    .toLowerCase()
    .replace(/([0-9])([a-z])/, '$1 $2');

  try {
    converted = units.convert(cleaned + ' to m');
  }
  catch (e) {
    return Promise.reject(new BadRequestError(`"${keyword}": unable to parse distance value`));
  }

  return Promise.resolve(converted);
}

/**
 * Verifies that "filter" contains only 1 field
 * @param {Array} fieldsList
 * @param {string} keyword
 * @returns {Promise} Promise resolving to the provided fields list
 */
function onlyOneFieldAttribute(fieldsList, keyword) {
  if (fieldsList.length > 1) {
    return Promise.reject(new BadRequestError(`"${keyword}" can contain only one attribute`));
  }

  return Promise.resolve(fieldsList);
}

/**
 * Verifies that "filter.attribute' exists
 * @param filter
 * @param keyword
 * @param attribute
 * @returns {Promise}
 */
function requireAttribute(filter, keyword, attribute) {
  if (!filter[attribute]) {
    return Promise.reject(new BadRequestError(`"${keyword}" requires the following attribute: ${attribute}`));
  }

  return Promise.resolve();
}

/**
 * Tests if "filter" is a non-object
 * @param {Object} filter
 * @param {string} keyword
 * @returns {Promise} Promise resolving to the object's keys
 */
function mustBeNonEmptyObject(filter, keyword) {
  var field;

  if (!filter || typeof filter !== 'object' || Array.isArray(filter) || (field = Object.keys(filter)).length === 0) {
    return Promise.reject(new BadRequestError(`"${keyword}" must be a non-empty object`));
  }

  return Promise.resolve(field);
}

/**
 * Verifies that filter.field is a string
 * @param filter
 * @param keyword
 * @param field
 * @returns {Promise}
 */
function mustBeString(filter, keyword, field) {
  if (typeof filter[field] !== 'string') {
    return Promise.reject(new BadRequestError(`Attribute "${field}" in "${keyword}" must be a string`));
  }

  return Promise.resolve();
}

/**
 * Verifies that filter.field is an array
 * @param filter
 * @param keyword
 * @param field
 * @returns {Promise}
 */
function mustBeNonEmptyArray(filter, keyword, field) {
  if (!Array.isArray(filter[field])) {
    return Promise.reject(new BadRequestError(`Attribute "${field}" in "${keyword}" must be an array`));
  }

  if (filter[field].length === 0) {
    return Promise.reject(new BadRequestError(`Attribute "${field}" in  "${keyword}" cannot be empty`));
  }

  return Promise.resolve();
}

/**
 * Verifies that ALL "fields" are contained in object "obj".
 * These fields must be of type "type", and an optional regular
 * expression can be provided to check that fields are well-formed
 *
 * @param {Object} obj - object containing the fields
 * @param {Array} fields - list of fields to test
 * @param {string} type - field type (typeof result)
 * @param {RegExp} [regex] - optional regex testing that a field is well-formed
 * @returns {Boolean}
 */
function fieldsExist(obj, fields, type, regex) {
  return fields.every(value => {
    return obj[value] !== undefined && typeof obj[value] === type && (!regex || regex.test(obj[value]));
  });
}

module.exports = Standardizer;
