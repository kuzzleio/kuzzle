/**
 * Stores a "not equals" condition in the
 * field-operand pairs storage
 *
 * This allows V8 to convert this object to a pure
 * C++ class, with direct access to its members,
 * instead of a dictionary with b-search access time
 *
 * @param {string} value
 * @param {Object} subfilter
 * @constructor
 */
function NotEqualsCondition (value, subfilter) {
  this.value = value;
  this.subfilters = [subfilter];
}

/**
 * @type {NotEqualsCondition}
 */
module.exports = NotEqualsCondition;
