/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const
  Bluebird = require('bluebird'),
  geohash = require('ngeohash'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
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
 */
class Standardizer {
  constructor () {
    this._regexp = null;
  }

  /**
   * Standardization entry point
   *
   * @param {object} filters
   * @returns {Promise} resolving to a standardized version of provided filters
   */
  standardize (filters) {
    const keywords = filters ? Object.keys(filters) : [];

    if (keywords.length === 0) {
      return Bluebird.resolve({});
    }

    if (keywords.length > 1) {
      return Bluebird.reject(new BadRequestError('Invalid filter syntax. Filters must have one keyword only'));
    }

    if (!this[keywords[0]]) {
      return Bluebird.reject(new BadRequestError(`Unknown DSL keyword: ${keywords[0]}`));
    }

    return this[keywords[0]](filters);
  }

  /**
   * Validate a "exists" keyword
   *
   * @param filter
   * @param [name] - optional keyword name to use. Defaults to 'exists'
   * @returns {Promise} standardized filter
   */
  exists (filter, name = 'exists') {
    return mustBeNonEmptyObject(filter[name], name)
      .then(field => onlyOneFieldAttribute(field, name))
      .then(() => mustBeString(filter[name], name, 'field'))
      .then(() => {
        if (filter[name].field.length === 0) {
          return Bluebird.reject(new BadRequestError('exists: cannot test empty field name'));
        }

        return filter;
      });
  }

  /**
   * Validate a "ids" keyword and converts it
   * into a series of "term" conditions
   *
   * @param filter
   * @returns {Promise} standardized filter
   */
  ids (filter) {
    return mustBeNonEmptyObject(filter.ids, 'ids')
      .then(field => onlyOneFieldAttribute(field, 'ids'))
      .then(() => requireAttribute(filter.ids, 'ids', 'values'))
      .then(() => mustBeNonEmptyArray(filter.ids, 'ids', 'values'))
      .then(() => {
        if (filter.ids.values.findIndex(v => typeof v !== 'string') > -1) {
          return Bluebird.reject(new BadRequestError('Array "values" in keyword "ids" can only contain strings'));
        }

        const result = {
          or: filter.ids.values.map(v => ({equals: {_id: v}}))
        };
        Object.defineProperties(result, {
          _isLeaf: {
            value: true,
            writable: true,
            enumerable: false
          }
        });

        return result;
      });
  }

  /**
   * Validate a "missing" keyword
   * @param filter
   * @returns {Promise} standardized filter
   */
  missing (filter) {
    return this.exists(filter, 'missing')
      .then(f => ({not: {exists: {field: f.missing.field}}}));
  }

  nothing () {
    return Bluebird.resolve({nothing: true});
  }

  /**
   * Validate a "range" keyword
   * @param filter
   * @returns {Promise} standardized filter
   */
  range (filter) {
    let rangeField;

    return mustBeNonEmptyObject(filter.range, 'range')
      .then(field => onlyOneFieldAttribute(field, 'range'))
      .then(field => {
        rangeField = field[0];
        return mustBeNonEmptyObject(filter.range[rangeField], `range.${rangeField}`);
      })
      .then(rangeValues => {
        let
          index = rangeValues.findIndex(v => ['gt', 'lt', 'gte', 'lte'].indexOf(v) === -1),
          high = Infinity,
          low = -Infinity,
          error = null;

        if (index > -1) {
          return Bluebird.reject(new BadRequestError(`"range.${rangeField}" accepts only the following attributes : gt, gte, lt, lte`));
        }

        index = rangeValues.findIndex(v => typeof filter.range[rangeField][v] !== 'number');

        if (index > -1) {
          return Bluebird.reject(new BadRequestError(`"range.${rangeField}.${rangeValues[index]}" must be a number`));
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
          return Bluebird.reject(error);
        }

        if (high <= low) {
          return Bluebird.reject(new BadRequestError(`"range.${rangeField}:" lower boundary must be strictly inferior to the upper one`));
        }

        return filter;
      });
  }

  /**
   * Generator function used by "regexp"
   * Validate a "regexp" keyword
   *
   * @generator
   * @param filter
   * @returns {Promise} standardized filter
   */
  static * _regexpGenerator (filter) {
    const field = yield mustBeNonEmptyObject(filter.regexp, 'regexp');
    yield onlyOneFieldAttribute(field, 'regexp');

    const regexpField = field[0];

    const
      isString = typeof filter.regexp[regexpField] === 'string',
      isObject = (typeof filter.regexp[regexpField] === 'object'
        && filter.regexp[regexpField] !== null
        && !Array.isArray(filter.regexp[regexpField])
        && Object.keys(filter.regexp[regexpField]).length > 0);

    if (!isObject && !isString) {
      throw new BadRequestError(`regexp.${regexpField} must be either a string or a non-empty object`);
    }

    let
      regexValue,
      flags;

    if (isString) {
      regexValue = filter.regexp[regexpField];
    }
    else {
      if (Object.keys(filter.regexp[regexpField]).findIndex(v => ['flags', 'value'].indexOf(v) === -1) > -1) {
        throw new BadRequestError('Keyword "regexp" can only contain the following attributes: flags, value');
      }

      yield requireAttribute(filter.regexp[regexpField], 'regexp', 'value');
      regexValue = filter.regexp[regexpField].value;

      if (filter.regexp[regexpField].flags) {
        yield mustBeString(filter.regexp[regexpField], 'regexp', 'flags');
        flags = filter.regexp[regexpField].flags;
      }
    }


    try {
      // eslint-disable-next-line no-new
      new RegExp(regexValue, flags); //NOSONAR
    }
    catch (err) {
      throw new BadRequestError(err.message);
    }

    return filter;
  }

  /**
   * Validate a "equals" keyword
   * @param filter
   * @returns {Promise} standardized filter
   */
  equals (filter) {
    return mustBeNonEmptyObject(filter.equals, 'equals')
      .then(field => onlyOneFieldAttribute(field, 'equals'))
      .then(field => mustBeScalar(filter.equals, 'equals', field[0]))
      .then(() => filter);
  }

  /**
   * Validate a "in" keyword and converts it into a series
   * of "equals" conditions
   * @param filter
   * @returns {Promise} standardized filter
   */
  in (filter) {
    let inValue;

    return mustBeNonEmptyObject(filter.in, 'in')
      .then(field => onlyOneFieldAttribute(field, 'in'))
      .then(field => {
        inValue = field[0];
        return mustBeNonEmptyArray(filter.in, 'in', inValue);
      })
      .then(() => {
        if (filter.in[inValue].findIndex(v => typeof v !== 'string') > -1) {
          return Bluebird.reject(new BadRequestError(`Array "${inValue}" in keyword "in" can only contain strings`));
        }

        const result = {
          or: filter.in[inValue].map(v => ({equals: {[inValue]: v}}))
        };

        Object.defineProperties(result, {
          _isLeaf: {
            value: true,
            writable: true,
            enumerable: false
          }
        });

        return result;
      });
  }

  /**
   * Validate a "geoBoundingBox" keyword
   * @param filter
   * @returns {Promise} standardized filter
   */
  geoBoundingBox (filter) {
    return mustBeNonEmptyObject(filter.geoBoundingBox, 'geoBoundingBox')
      .then(field => onlyOneFieldAttribute(field, 'geoBoundingBox'))
      .then(field => {
        const bBox = geoLocationToCamelCase(filter.geoBoundingBox[field[0]]);
        let standardized = {};

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
          return Bluebird.reject(new BadRequestError(`Unrecognized geo-point format in "geoBoundingBox.${field[0]}`));
        }

        return {geospatial: {geoBoundingBox: {[field[0]]: standardized}}};
      });
  }

  /**
   * Validate a "geoDistance" keyword
   * @param filter
   * @returns {Promise} standardized filter
   */
  geoDistance (filter) {
    const standardized = {geospatial: {geoDistance: {}}};

    return mustBeNonEmptyObject(filter.geoDistance, 'geoDistance')
      .then(fields => {

        if (fields.length !== 2 || !fields.includes('distance')) {
          return Bluebird.reject(new BadRequestError('"geoDistance" keyword requires a document field and a "distance" attribute'));
        }

        return mustBeString(filter.geoDistance, 'geoDistance', 'distance');
      })
      .then(() => {
        const
          docField = Object.keys(filter.geoDistance).find(f => f !== 'distance'),
          point = convertGeopoint(filter.geoDistance[docField]);

        if (point === null) {
          return Bluebird.reject(new BadRequestError(`geoDistance.${docField}: unrecognized point format`));
        }

        standardized.geospatial.geoDistance[docField] = {lat: point.lat, lon: point.lon};
        standardized.geospatial.geoDistance[docField].distance = convertDistance(filter.geoDistance.distance);

        return standardized;
      });
  }

  /**
   * Validate a "geoDistanceRange" keyword
   * @param filter
   * @returns {Promise} standardized filter
   */
  geoDistanceRange (filter) {
    let docField;
    const standardized = {geospatial: {geoDistanceRange: {}}};

    return mustBeNonEmptyObject(filter.geoDistanceRange, 'geoDistanceRange')
      .then(fields => {
        if (fields.length !== 3 || !fields.includes('from') || !fields.includes('to')) {
          return Bluebird.reject(new BadRequestError('"geoDistanceRange" keyword requires a document field and the following attributes: "from", "to"'));
        }

        docField = Object.keys(filter.geoDistanceRange).find(f => f !== 'from' && f !== 'to');
        return mustBeString(filter.geoDistanceRange, 'geoDistanceRange', 'from');
      })
      .then(() => mustBeString(filter.geoDistanceRange, 'geoDistanceRange', 'to'))
      .then(() => {
        const point = convertGeopoint(filter.geoDistanceRange[docField]);

        if (point === null) {
          return Bluebird.reject(new BadRequestError(`geoDistanceRange.${docField}: unrecognized point format`));
        }

        standardized.geospatial.geoDistanceRange[docField] = {lat: point.lat, lon: point.lon};
        standardized.geospatial.geoDistanceRange[docField].from = convertDistance(filter.geoDistanceRange.from);
        standardized.geospatial.geoDistanceRange[docField].to = convertDistance(filter.geoDistanceRange.to);

        if (standardized.geospatial.geoDistanceRange[docField].from >= standardized.geospatial.geoDistanceRange[docField].to) {
          return Bluebird.reject(new BadRequestError(`geoDistanceRange.${docField}: inner radius must be smaller than outer radius`));
        }

        return standardized;
      });
  }

  /**
   * Validate a "geoPolygon" keyword
   * @param filter
   * @returns {Promise} standardized filter
   */
  geoPolygon (filter) {
    let docField;

    return mustBeNonEmptyObject(filter.geoPolygon, 'geoPolygon')
      .then(fields => onlyOneFieldAttribute(fields, 'geoBoundingBox'))
      .then(fields => {
        docField = fields[0];
        return requireAttribute(filter.geoPolygon[docField], `geoPolygon.${docField}`, 'points');
      })
      .then(() => mustBeNonEmptyArray(filter.geoPolygon[docField], `geoPolygon.${docField}`, 'points'))
      .then(() => {
        const points = [];

        if (filter.geoPolygon[docField].points.length < 3) {
          return Bluebird.reject(new BadRequestError(`"geoPolygon.${docField}": at least 3 points are required to build a polygon`));
        }

        // Declaring "i" inside the "for" statement downgrades
        // performances by a factor of 3 to 4
        // Should be fixed in later V8 versions
        // (tested on Node 6.9.x)
        let i; // NOSONAR

        for (i = 0; i < filter.geoPolygon[docField].points.length; ++i) {
          const point = convertGeopoint(filter.geoPolygon[docField].points[i]);

          if (point === null) {
            return Bluebird.reject(new BadRequestError(`geoPolygon.${docField}: unrecognized point format (${JSON.stringify(filter.geoPolygon[docField].points[i])})`));
          }

          points.push([point.lat, point.lon]);
        }

        return {geospatial: {geoPolygon: {[docField]: points}}};
      });
  }

  /**
   * Validates a AND-like operand
   * @param {object} filter
   * @param {string} [keyword] name - user keyword entry (and, must, should_not).. used to display errors if any
   * @returns {Promise} standardized filter
   */
  and (filter, keyword = 'and') {
    return mustBeNonEmptyArray(filter, 'and', keyword)
      .then(() => this._standardizeFilterArray(filter, 'and'));
  }

  /**
   * Validates a OR-like operand
   * @param {object} filter
   * @param {string} [keyword] name - user keyword entry (or, should, must_not).. used to display errors if any
   * @returns {Promise} standardized filter
   */
  or (filter, keyword = 'or') {
    return mustBeNonEmptyArray(filter, 'or', keyword)
      .then(() => this._standardizeFilterArray(filter, 'or'));
  }

  /**
   * Validates a NOT operand
   * @param filter
   * @returns {Promise} standardized filter
   */
  not (filter) {
    let
      kwd;

    return mustBeNonEmptyObject(filter.not, 'not')
      .then(fields => onlyOneFieldAttribute(fields, 'not'))
      .then(fields => {
        kwd = fields[0];

        if (kwd === 'and' || kwd === 'or') {
          return mustBeNonEmptyArray(filter.not, 'not', kwd);
        }

        return mustBeNonEmptyObject(filter.not[kwd], `not.${kwd}`);
      })
      .then(() => {
        return this.standardize(filter.not)
          .then(result => {
            const k = Object.keys(result)[0];

            if (k === 'and' || k === 'or') {
              let _isLeaf = true;
              return Bluebird.all(result[k].map(f => this.standardize({not: f})
                .then(sub => {
                  if (sub.or || sub.and) {
                    _isLeaf = false;
                  }
                  return sub;
                })))
                .then(subs => {
                  const res = {
                    [k === 'and' ? 'or' : 'and']: subs
                  };

                  Object.defineProperties(res, {
                    _isLeaf: {
                      value: _isLeaf,
                      writable: true,
                      enumerable: false
                    }
                  });

                  return res;
                });
            }

            if (result.not) {
              return result.not;
            }
            return {not: result};
          });
      });
  }

  /**
   * Validates a BOOL operand
   * @param filter
   * @returns {Promise} standardized filter
   */
  bool (filter) {
    const
      attributes = ['must', 'must_not', 'should', 'should_not'];


    return mustBeNonEmptyObject(filter.bool, 'bool')
      .then(fields => {
        // the only accepted attributes are: must, must_not, should, should_not
        if (fields.findIndex(field => attributes.indexOf(field) === -1) > -1) {
          return Bluebird.reject(new BadRequestError(`"bool" operand accepts only the following attributes: ${attributes.join(', ')}`));
        }

        const f = {and: []};
        if (filter.bool.must) {
          f.and = f.and.concat(filter.bool.must);
        }
        if (filter.bool.must_not) {
          f.and.push({not: {or: filter.bool.must_not}});
        }
        if (filter.bool.should) {
          f.and.push({or: filter.bool.should});
        }
        if (filter.bool.should_not) {
          f.and.push({not: {and: filter.bool.should_not}});
        }

        return this.standardize(f);
      });
  }

  /**
   * Checks that a filters array is well-formed and standardizes it
   *
   * @private
   * @param {Object} filter - "and" or "or" filter, i.e. {and: [cond1, cond2, ...]}
   * @param {string} operand - "real" operand to test - "and" or "or"
   * @returns {Promise}
   */
  _standardizeFilterArray (filter, operand) {
    let idx;

    // All registered items must be non-array, non-empty objects
    idx = Object.keys(filter[operand]).findIndex(v => {
      return typeof filter[operand][v] !== 'object' ||
        Array.isArray(filter[operand][v]) ||
        Object.keys(filter[operand][v]).length === 0;
    });

    if (idx > -1) {
      return Bluebird.reject(new BadRequestError(`"${operand}" operand can only contain non-empty objects`));
    }

    const result = {
      [operand]: [],
      _isLeaf: true
    };

    Object.defineProperties(result, {
      _isLeaf: {
        value: true,
        writable: true,
        enumerable: false
      }
    });

    const
      leaves = [],
      andOrs = [];

    return Bluebird.reduce(filter[operand].map(f => this.standardize(f)), (acc, sub) => {
      if (sub[operand]) {
        // and in and || or in or
        leaves.push(...sub[operand]);
        if (!sub._isLeaf) {
          result._isLeaf = false;
        }
      }
      else if (sub.and || sub.or) {
        result._isLeaf = false;
        andOrs.push(sub);
      }
      else {
        leaves.push(sub);
      }
    }, result)
      .then(() => {
        // transforms filters like {and: [ equals, equals, equals, or ]}
        // { and: [ and: [ equals, equals, equals ], or} to allow the sub and/or condition
        // to be processed as one condition by the canonicalization
        if (!result._isLeaf && leaves.length > 1) {
          return this.standardize({[operand]: leaves})
            .then(sub => {
              result[operand] = andOrs.concat(sub);
              return result;
            });
        }

        result[operand] = andOrs.concat(leaves);

        if (result[operand].length === 1) {
          return result[operand][0];
        }

        return result;
      });
  }
}

Standardizer.prototype.regexp = Bluebird.coroutine(Standardizer._regexpGenerator);

module.exports = Standardizer;

/**
 * Verifies that "filter" contains only 1 field
 * @param {Array} fieldsList
 * @param {string} keyword
 * @returns {Promise} Promise resolving to the provided fields list
 */
function onlyOneFieldAttribute(fieldsList, keyword) {
  if (fieldsList.length > 1) {
    return Bluebird.reject(new BadRequestError(`"${keyword}" can contain only one attribute`));
  }

  return Bluebird.resolve(fieldsList);
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
    return Bluebird.reject(new BadRequestError(`"${keyword}" requires the following attribute: ${attribute}`));
  }

  return Bluebird.resolve();
}

/**
 * Tests if "filter" is a non-object
 * @param {object} filter
 * @param {string} keyword
 * @returns {Promise} Promise resolving to the object's keys
 */
function mustBeNonEmptyObject(filter, keyword) {
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
    return Bluebird.reject(new BadRequestError(`"${keyword}" must be a non-empty object`));
  }

  const fields = Object.keys(filter);

  if (fields.length === 0) {
    return Bluebird.reject(new BadRequestError(`"${keyword}" must be a non-empty object`));
  }

  return Bluebird.resolve(fields);
}

/**
 * Checks that filter.field is a scalar value
 * @param filter
 * @param keyword
 * @param field
 * @returns {*}
 */
function mustBeScalar(filter, keyword, field) {
  if (filter[field] instanceof Object || filter[field] === undefined) {
    return Bluebird.reject(new BadRequestError(`"${field}" in "${keyword}" must be either a string, a number, a boolean or null`));
  }

  return Bluebird.resolve();
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
    return Bluebird.reject(new BadRequestError(`Attribute "${field}" in "${keyword}" must be a string`));
  }

  return Bluebird.resolve();
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
    return Bluebird.reject(new BadRequestError(`Attribute "${field}" in "${keyword}" must be an array`));
  }

  if (filter[field].length === 0) {
    return Bluebird.reject(new BadRequestError(`Attribute "${field}" in  "${keyword}" cannot be empty`));
  }

  return Bluebird.resolve();
}

module.exports = Standardizer;
