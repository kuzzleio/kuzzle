/**
  * This file contains basic operators for compare. All operators must return only boolean
  */

var
  _ = require('lodash');

module.exports = {
  /**
   * Return true only if the value in field is grander or equal than the provided value
   */
  gte: function (value, fieldValue) {
    return value <= fieldValue;
  },

  /**
   * Return true only if the value in field is grander than the provided value
   */
  gt: function (value, fieldValue) {
    return value < fieldValue;
  },

  /**
   * Return true only if the value in field is lower or equal than the provided value
   */
  lte: function (value, fieldValue) {
    return value >= fieldValue;
  },

  /**
   * Return true only if the value in field is lower than the provided value
   */
  lt: function (value, fieldValue) {
    return value > fieldValue;
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
   * Return true only if the value in field pass the regexp test
   */
  regexp: function () {

  }
};