var
  BaseConstructor = require('../baseType'),
  validator = require('validator');

/**
 * @constructor
 */
function IpAddressType () {
  this.typeName = 'ip_address';
  this.allowChildren = false;
  this.allowedTypeOptions = ['not_empty'];
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
    return !fieldSpec.type_options.not_empty;
  }

  return validator.isIP(fieldValue);
};

/**
 * @param {TypeOptions} typeOptions
 * @return {boolean|TypeOptions}
 * @throws InternalError
 */
IpAddressType.prototype.validateFieldSpecification = function (typeOptions) {
  if (typeOptions.hasOwnProperty('not_empty') && typeof typeOptions.not_empty !== 'boolean') {
    return false;
  }

  if (!typeOptions.hasOwnProperty('not_empty')) {
    typeOptions.not_empty = false;
  }

  return typeOptions;
};

module.exports = IpAddressType;