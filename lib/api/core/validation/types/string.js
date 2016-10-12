var
  util = require('util'),
  BaseConstructor = require('../baseType'),
  allowedLengthOptions = ['min', 'max'];

/**
 * @constructor
 */
function StringType () {
  this.typeName = 'string';
  this.allowChildren = false;
  this.allowedTypeOptions = ['length'];
}

util.inherits(StringType, BaseConstructor);

/**
 * @param {TypeOptions} typeOptions
 * @param {*} fieldValue
 * @param {string[]} errorMessages
 */
StringType.prototype.validate = function (typeOptions, fieldValue, errorMessages) {
  if (typeof fieldValue !== 'string') {
    errorMessages.push('The field must be a string.');
    return false;
  }

  if (!typeOptions.length) {
    return true;
  }

  if (typeOptions.length.hasOwnProperty('min') && fieldValue.length < typeOptions.length.min) {
    errorMessages.push('The string is not long enough.');
    return false;
  }

  if (typeOptions.length.hasOwnProperty('max') && fieldValue.length > typeOptions.length.max) {
    errorMessages.push('The string is too long.');
    return false;
  }

  return true;
};

/**
 * @param {TypeOptions} typeOptions
 * @return {boolean|TypeOptions}
 * @throws InternalError
 */
StringType.prototype.validateFieldSpecification = function (typeOptions) {
  if (typeOptions.length && !this.checkAllowedProperties(typeOptions.length, allowedLengthOptions)) {
    return false;
  }

  if (typeOptions.length.hasOwnProperty('min') && typeOptions.length.hasOwnProperty('max')) {
    return typeOptions.length.max >= typeOptions.length.min;
  }

  return true;
};

module.exports = StringType;