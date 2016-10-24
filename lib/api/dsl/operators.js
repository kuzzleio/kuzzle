/**
 * This file contains basic operators for comparisons. Every operator must return a boolean value.
 */

var
  _ = require('lodash'),
  big = require('big.js'),
  gl = require('geolib'),
  geolib = require('geolib/dist/geolib.isPointInsideRobust')(gl),
  operators;

module.exports = operators = {

  /**
   * Return true only if the value in field is greater than or equal to the provided value
   *
   * @param {String} field the field that we have to check
   * @param {Number} value the value that we have to test on document
   * @param {Object} document document sent by user that we have to test
   * @returns {boolean} true only if the value in field is grander or equal than the provided value
   */
  gte: function operatorsGte (field, value, document) {
    var documentValue = document[field];

    if (documentValue === undefined) {
      return false;
    }

    return documentValue >= value;
  },

  /**
   * Return true only if the value in field is greater than the provided value
   *
   * @param {String} field the field that we have to check
   * @param {Number} value the value that we have to test on document
   * @param {Object} document document sent by user that we have to test
   * @returns {boolean} true only if the value in field is grander than the provided value
   */
  gt: function operatorsGt (field, value, document) {
    var documentValue = document[field];

    if (documentValue === undefined) {
      return false;
    }

    return documentValue > value;
  },

  /**
   * Return true only if the value in field is less than or equal to to the provided value
   *
   * @param {String} field the field that we have to check
   * @param {Number} value the value that we have to test on document
   * @param {Object} document document sent by user that we have to test
   * @returns {boolean} true only if the value in field is lower or equal than the provided value
   */
  lte: function operatorsLte (field, value, document) {
    var documentValue = document[field];

    if (documentValue === undefined) {
      return false;
    }

    return documentValue <= value;
  },

  /**
   * Return true only if the value in field is lower than the provided value
   *
   * @param {String} field the field that we have to check
   * @param {Number} value the value that we have to test on document
   * @param {Object} document document sent by user that we have to test
   * @returns {boolean} true only if the value in field is lower than the provided value
   */
  lt: function operatorsLt (field, value, document) {
    var documentValue = document[field];

    if (documentValue === undefined) {
      return false;
    }

    return documentValue < value;
  },

  /**
   * Return true only if the value in field begin to the provided values
   *
   * @param {String} field the field that we have to check
   * @param {Number} value the value that we have to test on document
   * @param {Object} document document sent by user that we have to test
   * @returns {boolean} true only if the value in field begin to the provided values
   */
  from: function operatorsFrom (field, value, document) {
    return operators.gte(field, value, document);
  },

  /**
   *  Return true only if the value in field end at the provided values
   *
   * @param {String} field the field that we have to check
   * @param {Number} value the value that we have to test on document
   * @param {Object} document document sent by user that we have to test
   * @returns {boolean} true only if the value in field end at the provided values
   */
  to: function operatorsTo (field, value, document) {
    return operators.lte(field, value, document);
  },

  /**
   * Return true only if the value in field matches the provided term
   *
   * @param {String} field the field that we have to check
   * @param {String} value the value that we have to test on document
   * @param {Object} document document sent by user that we have to test
   * @returns {boolean} true only if the value in field match the provided term
   */
  equals: function operatorsEquals (field, value, document) {
    return document[field] !== undefined && document[field] === value;
  },

  /**
   * Return true only if the value in field matches one of the provided terms
   *
   * @param {String} field the field that we have to check
   * @param {String} value the value that we have to test on document
   * @param {Object} document document sent by user that we have to test
   * @returns {boolean} true only if the value in field match the provided term
   */
  in: function operatorsIn (field, value, document) {
    var documentValue = document[field];

    if (documentValue === undefined || !Array.isArray(value)) {
      return false;
    }

    return value.indexOf(documentValue) !== -1;
  },

  /**
   * Return true if the document contains at least one non-null value
   *
   * @param {String} field the field that we have to check
   * @param {String} value / not used here but let for standardize
   * @param {Object} document document sent by user that we have to test
   * @returns {boolean} true only if the document have at least one non-null value
   */
  exists: function operatorsExists (field, value, document) {
    var documentValues = document[field];

    if (documentValues === undefined) {
      return false;
    }
    if (documentValues === null) {
      return false;
    }
    if (_.isObject(documentValues) && Object.keys(documentValues).length === 0) {
      return false;
    }

    if (Array.isArray(documentValues)) {
      return documentValues.some(documentValue => {
        return documentValue !== null;
      });
    }

    return true;
  },

  /**
   * Return true if the document field is into the given bounding box
   *
   * @param {String} field the field that we have to check
   * @param {{left: Number, right: Number, top: Number, bottom: Number}} value containing the bounding box coords
   * @param {Object} document the document sent by user that we have to test
   * @returns {boolean} true only if the document field is into the given bounding box
   */
  geoBoundingBox: function operatorsGeoBoundingBox (field, value, document) {
    var result;
    if (!operators.exists(field + '.lat', value, document)) {
      return false;
    }
    if (!operators.exists(field + '.lon', value, document)) {
      return false;
    }

    result = geolib.isInside(
      {latitude: document[field + '.lat'], longitude: document[field + '.lon']},
      [
        {latitude: value.left, longitude: value.top},
        {latitude: value.right, longitude: value.top},
        {latitude: value.right, longitude: value.bottom},
        {latitude: value.left, longitude: value.bottom}
      ]
    );

    return (result < 1);
  },

  /**
   * Return true only if the point in field is in a specific distance from a geo point
   *
   * @param {String} field the field that we have to check
   * @param {{lat: Number, lon: Number, distance: Number}} value containing the coordinates from which to calculate the distance and the distance
   * @param {Object} document the document sent by user that we have to test
   * @returns {boolean} true only if the document field is within a value.distance from the given coordinates
   */
  geoDistance: function operatorsGeoDistance (field, value, document) {
    if (!operators.exists(field + '.lat', value, document)) {
      return false;
    }
    if (!operators.exists(field + '.lon', value, document)) {
      return false;
    }

    // ugly trick to allow a point to be on the edge of the box + trick for deal with floating number
    value = {
      lat: big(value.lat).plus(10e-6).toString(),
      lon: big(value.lon).minus(10e-6).toString(),
      distance: parseFloat(value.distance)
    };

    return (geolib.getDistance(
      {latitude: document[field + '.lat'], longitude: document[field + '.lon']},
      {latitude: value.lat, longitude: value.lon}
    ) <= value.distance);
  },

  /**
   * Return true only if the point in field is in a specific distance included in a range
   *
   * @param {String} field the field that we have to check
   * @param {{lat: *, lon: *, from: *, to: *}} value containing the coordinates from which to calculate the distance and the distance
   * @param {Object} document the document sent by user that we have to test
   * @returns {boolean} true only if the document field is within a value.distance from the given coordinates
   */
  geoDistanceRange: function operatorsGeoDistanceRange (field, value, document) {
    var distance;
    if (!operators.exists(field + '.lat', value, document)) {
      return false;
    }
    if (!operators.exists(field + '.lon', value, document)) {
      return false;
    }

    // ugly trick to allow a point to be on the edge of the box + trick for deal with floating number
    value = {
      lat: big(value.lat).plus(10e-6).toString(),
      lon: big(value.lon).minus(10e-6).toString(),
      from: parseFloat(value.from),
      to: parseFloat(value.to)
    };

    distance = geolib.getDistance(
      {latitude: document[field + '.lat'], longitude: document[field + '.lon']},
      {latitude: value.lat, longitude: value.lon}
    );
    // workaround to allow to have from > to and to > from and from == to
    if (value.from >= value.to) {
      return (distance <= value.from && distance >= value.to);
    }
    else if (value.to > value.from) {
      return (distance <= value.to && distance >= value.from);
    }
  },

  /**
   * Return true if the document field is into the given bounding box
   *
   * @param {String} field the field that we have to check
   * @param {String} value containing the bounding box coords
   * @param {Object} document the document sent by user that we have to test
   * @returns {boolean} true only if the document field is into the given bounding box
   */
  geoPolygon: function operatorsGeoPolygon (field, value, document) {
    var
      polygon = [],
      i,
      result;

    if (!operators.exists(field + '.lat', value, document)) {
      return false;
    }
    if (!operators.exists(field + '.lon', value, document)) {
      return false;
    }

    for (i in value) {
      if (!value.hasOwnProperty(i)) {
        continue;
      }
      polygon.push(
        {
          latitude: value[i].lat,
          longitude: value[i].lon
        }
      );
    }

    result = geolib.isInside(
      {latitude: document[field + '.lat'], longitude: document[field + '.lon']},
      polygon
    );

    return (result < 1);
  },

  /**
   * Returns documents that have only null values or no value in the original field
   *
   * @param {String} field the field that we have to check
   * @param {String} value / not used here but let for standardize
   * @param {Object} document document sent by user that we have to test
   * @returns {boolean} true if the document field have no values, null values or if field is missing
   */
  missing: function operatorsMissing (field, value, document) {
    var documentValues = document[field];

    if (documentValues === undefined) {
      return true;
    }
    if (documentValues === null) {
      return true;
    }
    if (_.isObject(documentValues) && Object.keys(documentValues).length === 0) {
      return true;
    }

    if (Array.isArray(documentValues)) {
      return documentValues.every(documentValue => {
        return documentValue === null;
      });
    }

    return false;
  },

  regexp: function operatorsRegexp (field, value, document) {
    var
      docValue = document[field],
      match,
      regexp;
    
    match = /^\/(.*?)\/(.*)$/.exec(value);
    regexp = new RegExp(match[1], match[2]);
    

    if (typeof docValue !== 'string') {
      return false;
    }

    return regexp.test(docValue);
  }
  
};
