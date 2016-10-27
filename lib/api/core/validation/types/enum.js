var
  util = require('util'),
  BaseConstructor = require('../baseType');

/**
 * @constructor
 */
function EnumType () {
  this.typeName = 'enum';
  this.allowChildren = false;
  this.allowedTypeOptions = ['values'];
}

util.inherits(EnumType, BaseConstructor);

/**
 * @param {TypeOptions} typeOptions
 * @param {*} fieldValue
 * @param {string[]} errorMessages
 */
EnumType.prototype.validate = function enumTypeValidate (typeOptions, fieldValue, errorMessages) {
  if (typeof fieldValue !== 'string') {
    errorMessages.push('The field must be a string.');
    return false;
  }

  if (typeOptions.values.indexOf(fieldValue) === -1) {
    errorMessages.push(`The field only accepts following values: "${typeOptions.values.join(', ')}".`);
    return false;
  }

  return true;
};

/**
 * @param {TypeOptions} typeOptions
 * @return {boolean|TypeOptions}
 * @throws InternalError
 */
EnumType.prototype.validateFieldSpecification = function enumTypeValidateFieldSpecification (typeOptions) {
  if (!typeOptions.hasOwnProperty('values') || !Array.isArray(typeOptions.values) || typeOptions.values.length === 0) {
    return false;
  }

  return !typeOptions.values.some(value => typeof value !== 'string');
};

module.exports = EnumType;