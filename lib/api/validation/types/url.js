var
  BaseConstructor = require('../baseType'),
  validator = require('validator');

/**
 * @constructor
 */
function UrlType () {
  this.typeName = 'url';
  this.allowChildren = false;
  this.allowedTypeOptions = ['notEmpty'];
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
    return !typeOptions.notEmpty;
  }

  return validator.isURL(fieldValue);
};

/**
 * @param {TypeOptions} typeOptions
 * @return {boolean|TypeOptions}
 * @throws InternalError
 */
UrlType.prototype.validateFieldSpecification = function (typeOptions) {
  if (typeOptions.hasOwnProperty('notEmpty') && typeof typeOptions.notEmpty !== 'boolean') {
    return false;
  }

  if (!typeOptions.hasOwnProperty('notEmpty')) {
    typeOptions.notEmpty = false;
  }

  return typeOptions;
};

module.exports = UrlType;