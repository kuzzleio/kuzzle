var
  BaseConstructor = require('../baseType'),
  validator = require('validator');

/**
 * @constructor
 */
function EmailType () {
  this.typeName = 'email';
  this.allowChildren = false;
  this.allowedTypeOptions = ['notEmpty'];
}

EmailType.prototype = new BaseConstructor();

/**
 * @param {TypeOptions} typeOptions
 * @param {*} fieldValue
 */
EmailType.prototype.validate = function (typeOptions, fieldValue) {
  if (typeof fieldValue !== 'string') {
    return false;
  }

  if (fieldValue.length === 0) {
    return !typeOptions.notEmpty;
  }

  return validator.isEmail(fieldValue);
};

/**
 * @param {TypeOptions} typeOptions
 * @return {boolean|TypeOptions}
 * @throws InternalError
 */
EmailType.prototype.validateFieldSpecification = function (typeOptions) {
  if (typeOptions.hasOwnProperty('notEmpty') && typeof typeOptions.notEmpty !== 'boolean') {
    return false;
  }

  if (!typeOptions.hasOwnProperty('notEmpty')) {
    typeOptions.notEmpty = false;
  }

  return typeOptions;
};

module.exports = EmailType;