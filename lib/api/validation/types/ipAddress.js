var
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

IpAddressType.prototype = new BaseConstructor();

/**
 * @param {StructuredFieldSpecification} fieldSpec
 * @param {*} fieldValue
 */
IpAddressType.prototype.validate = function (fieldSpec, fieldValue) {
  if (typeof fieldValue !== 'string') {
    return false;
  }

  if (fieldValue.length === 0) {
    return !fieldSpec.type_options.notEmpty;
  }

  return validator.isIP(fieldValue);
};

/**
 * @param {TypeOptions} typeOptions
 * @return {boolean|TypeOptions}
 * @throws InternalError
 */
IpAddressType.prototype.validateFieldSpecification = function (typeOptions) {
  if (typeOptions.hasOwnProperty('notEmpty') && typeof typeOptions.notEmpty !== 'boolean') {
    return false;
  }

  if (!typeOptions.hasOwnProperty('notEmpty')) {
    typeOptions.notEmpty = false;
  }

  return typeOptions;
};

module.exports = IpAddressType;