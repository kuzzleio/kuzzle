var
  util = require('util'),
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

util.inherits(UrlType, BaseConstructor);

/**
 * @param {TypeOptions} typeOptions
 * @param {*} fieldValue
 * @param {string[]} errorMessages
 */
UrlType.prototype.validate = function (typeOptions, fieldValue, errorMessages) {
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

  if (!validator.isURL(fieldValue)) {
    errorMessages.push('The string must be a valid URL.');
    return false;
  }

  return true;
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