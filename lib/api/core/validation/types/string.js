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
StringType.prototype.validate = function stringTypeValidate (typeOptions, fieldValue, errorMessages) {
  if (typeof fieldValue !== 'string') {
    errorMessages.push('The field must be a string.');
    return false;
  }

  if (!typeOptions.length) {
    return true;
  }

  if (typeOptions.length.hasOwnProperty('min') && fieldValue.length < typeOptions.length.min) {
    errorMessages.push(`Invalid string length. Expected min: ${typeOptions.length.min}. Received: ${fieldValue.length} "${fieldValue}"`);
    return false;
  }

  if (typeOptions.length.hasOwnProperty('max') && fieldValue.length > typeOptions.length.max) {
    errorMessages.push(`Invalid string length. Expected max: ${typeOptions.length.max}. Received: ${fieldValue.length} "${fieldValue}"`);
    return false;
  }

  return true;
};

/**
 * @param {TypeOptions} typeOptions
 * @return {boolean|TypeOptions}
 * @throws InternalError
 */
StringType.prototype.validateFieldSpecification = function stringTypeValidateFieldSpecification (typeOptions) {
  if (typeOptions.hasOwnProperty('length') && !this.checkAllowedProperties(typeOptions.length, allowedLengthOptions)) {
    return false;
  }

  if (typeOptions.hasOwnProperty('length') && typeOptions.length.hasOwnProperty('min') && typeOptions.length.hasOwnProperty('max')) {
    return typeOptions.length.max >= typeOptions.length.min;
  }

  return true;
};

module.exports = StringType;