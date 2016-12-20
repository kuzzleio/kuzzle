var
  util = require('util'),
  BaseConstructor = require('../baseType'),
  validator = require('validator');

/**
 * @constructor
 */
function IpAddressType () {
  this.typeName = 'ip_address';
  this.allowChildren = false;
  this.allowedTypeOptions = ['notEmpty'];
}

util.inherits(IpAddressType, BaseConstructor);

/**
 * @param {TypeOptions} typeOptions
 * @param {*} fieldValue
 * @param {string[]} errorMessages
 */
IpAddressType.prototype.validate = function ipAddressTypeValidate (typeOptions, fieldValue, errorMessages) {
  if (typeof fieldValue !== 'string') {
    errorMessages.push('The field must be a string.');
    return false;
  }

  if (fieldValue.length === 0) {
    if (typeOptions.notEmpty) {
      errorMessages.push('The string must not be empty.');
      return false;
    }
    return true;
  }

  if (!validator.isIP(fieldValue)) {
    errorMessages.push('The string must be a valid IP address.');
    return false;
  }

  return true;
};

/**
 * @param {TypeOptions} typeOptions
 * @return {boolean|TypeOptions}
 * @throws InternalError
 */
IpAddressType.prototype.validateFieldSpecification = function ipAddressTypeValidateFieldSpecfication (typeOptions) {
  if (typeOptions.hasOwnProperty('notEmpty') && typeof typeOptions.notEmpty !== 'boolean') {
    return false;
  }

  if (!typeOptions.hasOwnProperty('notEmpty')) {
    typeOptions.notEmpty = false;
  }

  return typeOptions;
};

module.exports = IpAddressType;