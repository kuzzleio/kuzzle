'use strict';

var
  SortedArray = require('sorted-array'),
  strcmp = require('../../util/stringCompare');

/**
 * Stores a field-operand pair.
 *
 * This allows V8 to convert this object to a pure
 * C++ class, with direct access to its members,
 * instead of a dictionary with b-search access time
 *
 * @returns {FieldOperand}
 * @constructor
 */
function FieldOperand() {
  this.keys = new SortedArray([], strcmp);
  this.fields = {};
  this.custom = {};

  return this;
}

/**
 * @type {FieldOperand}
 */
module.exports = FieldOperand;
