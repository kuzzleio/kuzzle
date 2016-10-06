var
  BaseConstructor = require('../baseType'),
  validator = require('validator');

/**
 * @constructor
 */
function UrlType () {
  this.typeName = 'url';
  this.allowChildren = false;
  this.allowedTypeOptions = ['not_empty'];
}

UrlType.prototype = new BaseConstructor();

/**
 * @param {TypeOptions} typeOptions
 * @param {*} fieldValue
 */
UrlType.prototype.validate = function (typeOptions, fieldValue) {
  if (typeof fieldValue !== 'string') {
    return false;
  }

  if (fieldValue.length === 0) {
    return !typeOptions.not_empty;
  }

  return validator.isURL(fieldValue);
};

/**
 * @param {TypeOptions} typeOptions
 * @return {boolean|TypeOptions}
 * @throws InternalError
 */
UrlType.prototype.validateFieldSpecification = function (typeOptions) {
  if (typeOptions.hasOwnProperty('not_empty') && typeof typeOptions.not_empty !== 'boolean') {
    return false;
  }

  if (!typeOptions.hasOwnProperty('not_empty')) {
    typeOptions.not_empty = false;
  }

  return typeOptions;
};

module.exports = UrlType;