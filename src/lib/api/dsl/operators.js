/**
  * This file contains basic operators for comparisons. Every operator must return a boolean value.
  */

var
  _ = require('lodash'),
  geolib = require('geolib');

module.exports = operators = {

  /**
   * Return true only if the value in field is greater than or equal to the provided value
   *
   * @param {String} field the field that we have to check
   * @param {String} value the value that we have to test on document
   * @param {Object} document document sent by user that we have to test
   * @returns {boolean} true only if the value in field is grander or equal than the provided value
   */
  gte: function (field, value, document) {
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
   * @param {String} value the value that we have to test on document
   * @param {Object} document document sent by user that we have to test
   * @returns {boolean} true only if the value in field is grander than the provided value
   */
  gt: function (field, value, document) {
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
   * @param {String} value the value that we have to test on document
   * @param {Object} document document sent by user that we have to test
   * @returns {boolean} true only if the value in field is lower or equal than the provided value
   */
  lte: function (field, value, document) {
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
   * @param {String} value the value that we have to test on document
   * @param {Object} document document sent by user that we have to test
   * @returns {boolean} true only if the value in field is lower than the provided value
   */
  lt: function (field, value, document) {
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
   * @param {String} value the value that we have to test on document
   * @param {Object} document document sent by user that we have to test
   * @returns {boolean} true only if the value in field begin to the provided values
   */
  from: function (field, value, document) {
    return this.gte(document[field], value);
  },

  /**
   *  Return true only if the value in field end at the provided values
   *
   * @param {String} field the field that we have to check
   * @param {String} value the value that we have to test on document
   * @param {Object} document document sent by user that we have to test
   * @returns {boolean} true only if the value in field end at the provided values
   */
  to: function (field, value, document) {
    return this.lte(document[field], value);
  },

  /**
   * Return true only if the value in field match the provided term
   *
   * @param {String} field the field that we have to check
   * @param {String} value the value that we have to test on document
   * @param {Object} document document sent by user that we have to test
   * @returns {boolean} true only if the value in field match the provided term
   */
  term: function (field, value, document) {
    var documentValue = document[field];

    if (documentValue === undefined) {
      return false;
    }

    return documentValue === value;
  },

  /**
   * Return true only if the value in field match one of the provided terms
   *
   * @param {String} field the field that we have to check
   * @param {String} value the value that we have to test on document
   * @param {Object} document document sent by user that we have to test
   * @returns {boolean} true only if the value in field match the provided term
   */
  terms: function (field, value, document) {
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
  exists: function (field, value, document) {
    var documentValues = document[field];

    if (documentValues === undefined) {
      return false;
    }
    if (documentValues === null) {
      return false;
    }
    if (_.isObject(documentValues) && _.isEmpty(documentValues)) {
      return false;
    }

    if (Array.isArray(documentValues)) {
     return documentValues.some(function (documentValue) {
       return documentValue !== null;
     });
    }

    return true;
  },

  geoBoundingBox: function (field, value, document) {
    if (!operators.exists(field + '.lat', value, document)) {
      return false;
    }
    if (!operators.exists(field + '.lon', value, document)) {
      return false;
    }

    return geolib.isPointInside(
      {  latitude: document[field + '.lat'], longitude: document[field + '.lon'] },
      [
        { latitude: value.left, longitude: value.top },
        { latitude: value.right, longitude: value.top },
        { latitude: value.right, longitude: value.bottom },
        { latitude: value.left, longitude: value.bottom }
      ]
    );

  }

};