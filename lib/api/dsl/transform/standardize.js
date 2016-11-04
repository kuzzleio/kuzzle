var
  Promise = require('bluebird'),
  geohash = require('ngeohash'),
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  convertGeopoint = require('../util/convertGeopoint'),
  convertDistance = require('../util/convertDistance'),
  geoLocationToCamelCase = require('../util/geoLocationToCamelCase'),
  fieldsExist = require('../util/fieldsExist');

const RegexStringBoundingBox = /^([-+]?\d*\.?\d+),\s*([-+]?\d*\.?\d+)$/;
const RegexGeohash = /^[0-9a-z]{4,}$/;

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
  this.standardize = function standardize (filters) {
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
  this.dsl.exists = function exists (filter, name = 'exists') {
    return mustBeNonEmptyObject(filter[name], name)
      .then(field => onlyOneFieldAttribute(field, name))
      .then(() => mustBeString(filter[name], name, 'field'))
      .then(() => {
        if (filter[name].field.length === 0) {
          return Promise.reject(new BadRequestError('exists: cannot test empty field name'));
        }

        return filter;
      });
  };

  /**
   * Validate a "ids" keyword and converts it
   * into a series of "term" conditions
   *
   * @param filter
   * @returns {Promise} standardized filter
   */
  this.dsl.ids = function ids (filter) {
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
  this.dsl.missing = function missing (filter) {
    return self.dsl.exists(filter, 'missing')
      .then(f => ({not: {exists: {field: f.missing.field}}}));
  };

  /**
   * Validate a "range" keyword
   * @param filter
   * @returns {Promise} standardized filter
   */
  this.dsl.range = function range (filter) {
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
            else {
              high = filter.range[rangeField][rangeType];
            }
          }

          if (rangeType.startsWith('gt')) {
            if (low !== -Infinity) {
              error = new BadRequestError(`"range.${rangeField}:" only 1 lower boundary allowed`);
            }
            else {
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
  this.dsl.regexp = function regexp (filter) {
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
      .then(() => {
        try {
          // eslint-disable-next-line no-new
          new RegExp(filter.regexp[regexpField].value, filter.regexp[regexpField].flags);
        }
        catch (err) {
          return Promise.reject(new BadRequestError(`Invalid regular expression "${filter.regexp[regexpField].value}": ${err.message}`));
        }

        return filter;
      });
  };

  /**
   * Validate a "equals" keyword
   * @param filter
   * @returns {Promise} standardized filter
   */
  this.dsl.equals = function equals (filter) {
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
  this.dsl.in = function dslin (filter) {
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
  this.dsl.geoBoundingBox = function geoBoundingBox (filter) {
    return mustBeNonEmptyObject(filter.geoBoundingBox, 'geoBoundingBox')
      .then(field => onlyOneFieldAttribute(field, 'geoBoundingBox'))
      .then(field => {
        var
          bBox = geoLocationToCamelCase(filter.geoBoundingBox[field[0]]),
          standardized = {};

        /*
         * Multiple geopoint formats are accepted
         * We verify that the provided geopoint matches one of the
         * support format, and we convert it to a standardized
         * geopoint for further uses
         */

        // { top: -74.1, left: 40.73, bottom: -71.12, right: 40.01 }
        if (fieldsExist(bBox, ['top', 'left', 'bottom', 'right'], 'number')) {
          ['top', 'left', 'bottom', 'right'].forEach(v => {
            standardized[v] = bBox[v];
          });
        }
        // { topLeft: { lat: 40.73, lon: -74.1 }, bottomRight: { lat: 40.01, lon: -71.12 } }
        else if (fieldsExist(bBox, ['bottomRight', 'topLeft'], 'object') &&
          fieldsExist(bBox.bottomRight, ['lat', 'lon'], 'number') &&
          fieldsExist(bBox.topLeft, ['lat', 'lon'], 'number')) {
          standardized = {
            top: bBox.topLeft.lat,
            left: bBox.topLeft.lon,
            bottom: bBox.bottomRight.lat,
            right: bBox.bottomRight.lon
          };
        }
        // { topLeft: [ -74.1, 40.73 ], bottomRight: [ -71.12, 40.01 ] }
        else if (fieldsExist(bBox, ['bottomRight', 'topLeft'], 'object') &&
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
        else if (fieldsExist(bBox, ['bottomRight', 'topLeft'], 'string', RegexStringBoundingBox)) {
          let tmp = bBox.topLeft.match(RegexStringBoundingBox);
          standardized.top = Number.parseFloat(tmp[1]);
          standardized.left = Number.parseFloat(tmp[2]);

          tmp = bBox.bottomRight.match(RegexStringBoundingBox);
          standardized.bottom = Number.parseFloat(tmp[1]);
          standardized.right = Number.parseFloat(tmp[2]);
        }
        // { topLeft: "dr5r9ydj2y73", bottomRight: "drj7teegpus6" }
        else if (fieldsExist(bBox, ['bottomRight', 'topLeft'], 'string', RegexGeohash)) {
          let tmp = geohash.decode(bBox.topLeft);
          standardized.top = tmp.latitude;
          standardized.left = tmp.longitude;

          tmp = geohash.decode(bBox.bottomRight);
          standardized.bottom = tmp.latitude;
          standardized.right = tmp.longitude;
        }

        if (!standardized.top) {
          return Promise.reject(new BadRequestError(`Unrecognized geo-point format in "geoBoundingBox.${field[0]}`));
        }

        return {geospatial: {geoBoundingBox: {[field[0]]: standardized}}};
      });
  };

  /**
   * Validate a "geoDistance" keyword
   * @param filter
   * @returns {Promise} standardized filter
   */
  this.dsl.geoDistance = function geoDistance (filter) {
    var
      docField,
      standardized = {geospatial: {geoDistance: {}}};

    return mustBeNonEmptyObject(filter.geoDistance, 'geoDistance')
      .then(fields => {

        if (fields.length !== 2 || !fields.includes('distance')) {
          return Promise.reject(new BadRequestError('"geoDistance" keyword requires a document field and a "distance" attribute'));
        }

        return mustBeString(filter.geoDistance, 'geoDistance', 'distance');
      })
      .then(() => {
        let point;

        docField = Object.keys(filter.geoDistance).find(f => f !== 'distance');

        point = convertGeopoint(filter.geoDistance[docField]);

        if (point === null) {
          return Promise.reject(new BadRequestError(`geoDistance.${docField}: unrecognized point format`));
        }

        standardized.geospatial.geoDistance[docField] = {lat: point.lat, lon: point.lon};

        try {
          standardized.geospatial.geoDistance[docField].distance = convertDistance(filter.geoDistance.distance);
        }
        catch (e) {
          return Promise.reject(e);
        }

        return standardized;
      });
  };

  /**
   * Validate a "geoDistanceRange" keyword
   * @param filter
   * @returns {Promise} standardized filter
   */
  this.dsl.geoDistanceRange = function geoDistanceRange (filter) {
    var
      docField,
      standardized = {geospatial: {geoDistanceRange: {}}};

    return mustBeNonEmptyObject(filter.geoDistanceRange, 'geoDistanceRange')
      .then(fields => {
        if (fields.length !== 3 || !fields.includes('from') || !fields.includes('to')) {
          return Promise.reject(new BadRequestError('"geoDistanceRange" keyword requires a document field and the following attributes: "from", "to"'));
        }

        docField = Object.keys(filter.geoDistanceRange).find(f => f !== 'from' && f !== 'to');
        return mustBeString(filter.geoDistanceRange, 'geoDistanceRange', 'from');
      })
      .then(() => mustBeString(filter.geoDistanceRange, 'geoDistanceRange', 'to'))
      .then(() => {
        let point = convertGeopoint(filter.geoDistanceRange[docField]);

        if (point === null) {
          return Promise.reject(new BadRequestError(`geoDistanceRange.${docField}: unrecognized point format`));
        }

        standardized.geospatial.geoDistanceRange[docField] = {lat: point.lat, lon: point.lon};

        try {
          standardized.geospatial.geoDistanceRange[docField].from = convertDistance(filter.geoDistanceRange.from);
          standardized.geospatial.geoDistanceRange[docField].to = convertDistance(filter.geoDistanceRange.to);
        }
        catch (e) {
          return Promise.reject(e);
        }

        if (standardized.geospatial.geoDistanceRange[docField].from >= standardized.geospatial.geoDistanceRange[docField].to) {
          return Promise.reject(new BadRequestError(`geoDistanceRange.${docField}: inner radius must be smaller than outer radius`));
        }

        return standardized;
      });
  };

  /**
   * Validate a "geoPolygon" keyword
   * @param filter
   * @returns {Promise} standardized filter
   */
  this.dsl.geoPolygon = function geoPolygon (filter) {
    var
      docField;

    return mustBeNonEmptyObject(filter.geoPolygon, 'geoPolygon')
      .then(fields => onlyOneFieldAttribute(fields, 'geoBoundingBox'))
      .then(fields => {
        docField = fields[0];
        return requireAttribute(filter.geoPolygon[docField], `geoPolygon.${docField}`, 'points');
      })
      .then(() => mustBeNonEmptyArray(filter.geoPolygon[docField], `geoPolygon.${docField}`, 'points'))
      .then(() => {
        let points = [];

        if (filter.geoPolygon[docField].points.length < 3) {
          return Promise.reject(new BadRequestError(`"geoPolygon.${docField}": at least 3 points are required to build a polygon`));
        }

        for (let i = 0; i < filter.geoPolygon[docField].points.length; ++i) {
          let point = convertGeopoint(filter.geoPolygon[docField].points[i]);

          if (point === null) {
            return Promise.reject(new BadRequestError(`geoPolygon.${docField}: unrecognized point format (${JSON.stringify(filter.geoPolygon[docField].points[i])})`));
          }

          points.push([point.lat, point.lon]);
        }

        return {geospatial: {geoPolygon: {[docField]: points}}};
      });
  };

  /**
   * Validates a AND-like operand
   * @param {Object} filter
   * @param {string} [operand] name - used by AND, MUST and MUST_NOT operands
   * @returns {Promise} standardized filter
   */
  this.dsl.and = function and (filter, operand = 'and') {
    return mustBeNonEmptyArray(filter, operand, operand)
      .then(() => standardizeFilterArray(self.standardize, filter[operand], operand))
      .then(standardized => ({[operand]: standardized}));
  };

  /**
   * Validates a OR-like operand
   * @param {Object} filter
   * @param {string} [operand] name - used by OR, SHOULD and SHOULD_NOT operands
   * @returns {Promise} standardized filter
   */
  this.dsl.or = function or (filter, operand = 'or') {
    return mustBeNonEmptyArray(filter, operand, operand)
      .then(() => standardizeFilterArray(self.standardize, filter[operand], operand))
      .then(standardized => ({[operand]: standardized}));
  };

  /**
   * Validates a NOT operand
   * @param filter
   * @returns {Promise} standardized filter
   */
  this.dsl.not = function not (filter) {
    var kwd;

    return mustBeNonEmptyObject(filter.not, 'not')
      .then(fields => onlyOneFieldAttribute(fields, 'not'))
      .then(fields => {
        kwd = fields[0];

        if (kwd === 'and' || kwd === 'or') {
          return mustBeNonEmptyArray(filter.not, 'not', kwd);
        }

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
  this.dsl.bool = function bool (filter) {
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

module.exports = Standardizer;
