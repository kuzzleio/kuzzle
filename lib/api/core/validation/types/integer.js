var
  util = require('util'),
  BaseConstructor = require('../baseType'),
  allowedRangeOptions = ['min', 'max'];

/**
 * @constructor
 */
function IntegerType () {
  this.typeName = 'integer';
  this.allowChildren = false;
  this.allowedTypeOptions = ['range'];
}

util.inherits(IntegerType, BaseConstructor);

/**
 * @param {TypeOptions} typeOptions
 * @param {*} fieldValue
 * @param {string[]} errorMessages
 */
IntegerType.prototype.validate = function (typeOptions, fieldValue, errorMessages) {
  if (typeof fieldValue !== 'number' || !Number.isInteger(fieldValue)) {
    errorMessages.push('The field must be an integer');
    return false;
  }

  if (!typeOptions.range) {
    return true;
  }

  if (typeOptions.range.hasOwnProperty('min') && fieldValue < typeOptions.range.min) {
    errorMessages.push('The value is lesser than the minimum.');
    return false;
  }

  if (typeOptions.range.hasOwnProperty('max') && fieldValue > typeOptions.range.max) {
    errorMessages.push('The value is greater than the maximum.');
    return false;
  }

  return true;
};

/**
 * @param {TypeOptions} typeOptions
 * @return {boolean|TypeOptions}
 * @throws InternalError
 */
IntegerType.prototype.validateFieldSpecification = function (typeOptions) {
  if (typeOptions.range && !this.checkAllowedProperties(typeOptions.range, allowedRangeOptions)) {
    return false;
  }

  if (typeOptions.range.hasOwnProperty('min') && typeOptions.range.hasOwnProperty('max')) {
    return typeOptions.range.max >= typeOptions.range.min;
  }

  return true;
};

module.exports = IntegerType;