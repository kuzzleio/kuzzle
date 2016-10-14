var
  util = require('util'),
  BaseConstructor = require('../baseType'),
  allowedRangeOptions = ['min', 'max'];

/**
 * @constructor
 */
function NumericType () {
  this.typeName = 'numeric';
  this.allowChildren = false;
  this.allowedTypeOptions = ['range'];
}

util.inherits(NumericType, BaseConstructor);

/**
 * @param {TypeOptions} typeOptions
 * @param {*} fieldValue
 * @param {string[]} errorMessages
 */
NumericType.prototype.validate = function (typeOptions, fieldValue, errorMessages) {
  if (typeof fieldValue !== 'number') {
    errorMessages.push('The field must be a number.');
    return false;
  }

  if (typeOptions.hasOwnProperty('range')) {
    if (typeOptions.range.hasOwnProperty('min') && fieldValue < typeOptions.range.min) {
      errorMessages.push('The value is lesser than the minimum.');
      return false;
    }

    if (typeOptions.range.hasOwnProperty('max') && fieldValue > typeOptions.range.max) {
      errorMessages.push('The value is greater than the maximum.');
      return false;
    }
  }

  return true;
};

/**
 * @param {TypeOptions} typeOptions
 * @return {boolean|TypeOptions}
 * @throws InternalError
 */
NumericType.prototype.validateFieldSpecification = function (typeOptions) {
  if (typeOptions.hasOwnProperty('range') && !this.checkAllowedProperties(typeOptions.range, allowedRangeOptions)) {
    return false;
  }

  if (typeOptions.hasOwnProperty('range') && typeOptions.range.hasOwnProperty('min') && typeOptions.range.hasOwnProperty('max')) {
    return typeOptions.range.max >= typeOptions.range.min;
  }

  return true;
};

module.exports = NumericType;