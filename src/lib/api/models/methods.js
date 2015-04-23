var
  _ = require('lodash');

module.exports = {

  /**
   * Returns true only if the value in field has at least one non-null value
   */
  exists: function () {

  },

  /**
   * Return true only if the point in field is in the bounding box
   */
  geoBoundingBox: function () {

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
   * Return true only if the value in field is in a certain range
   */
  range: function () {

  },

  /**
   * Return true only if the value in field is grander or equal than the provided value
   */
  gte: function () {

  },

  /**
   * Return true only if the value in field is grander than the provided value
   */
  gt: function () {

  },

  /**
   * Return true only if the value in field is lower or equal than the provided value
   */
  lte: function () {

  },

  /**
   * Return true only if the value in field is lower than the provided value
   */
  lt: function () {

  },

  /**
   * Return true only if the value in field begin to the provided values
   */
  from: function (value, fieldValue) {
    return this.gte(value, fieldValue);
  },

  /**
   *  Return true only if the value in field end at the provided values
   */
  to: function (value, fieldValue) {
    return this.lte(value, fieldValue);
  },

  /**
   * Return true only if the value in field pass the regexp test
   */
  regexp: function () {

  },

  /**
   * Return true only if the value in field match the provided term
   *
   * @param value
   * @param fieldValue
   * @returns {boolean}
   */
  term: function (value, fieldValue) {
    return value === fieldValue;
  },

  /**
   * Return true only if the value in field match on any (configurable) of the provided terms
   */
  terms: function () {

  },

  /**
   * Return true only if values in document are valid according to object provided
   */
  bool: function (document, object) {
    var noResult;

    // Invert boolean because we want stop loop when a function return false or if there is an error
    noResult = _.some(Object.keys(object), function (fn) {
      if (!this[fn]) {
        return true;
      }

      if (!this[fn](document, object[fn])) {
        return true;
      }
    });

    return !noResult;
  },

  /**
   * Return true only if the the clause not appear in the matching documents.
   */
  must: function (document, filters) {
    var noResult;

    // Invert boolean because we want stop loop when a function return false or if there is an error
    noResult = _.some(Object.keys(filters), function (fn) {
      if (!this[fn]) {
        return true;
      }

      var
        field = Object.keys(filters[fn])[0],
        value = filters[fn][field];

      if (!document[field]) {
        return true;
      }

      if (!this[fn](value, document[field])) {
        return true;
      }
    });

    return !noResult;
  },

  /**
   * Return true only if value in field not correspond to all filters/values provided
   */
  mustNot: function () {

  },

  /**
   * Return true only if the clause should appear in the matching document.
   * In a boolean query with no must clauses, one or more should clauses must match a document.
   * The minimum number of should clauses to match can be set using the minimum_should_match parameter.
   */
  should: function () {

  }

};