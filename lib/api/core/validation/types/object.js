var
  util = require('util'),
  BaseConstructor = require('../baseType');

/**
 * @constructor
 */
function ObjectType () {
  this.typeName = 'object';
  this.allowChildren = true;
  this.allowedTypeOptions = ['strict'];
}

util.inherits(ObjectType, BaseConstructor);

/**
 * @param {TypeOptions} typeOptions
 * @param {*} fieldValue
 * @param {string[]} errorMessages
 * @returns {boolean}
 */
ObjectType.prototype.validate = function objectTypeValidate (typeOptions, fieldValue, errorMessages) {
  if (typeof fieldValue !== 'object') {
    errorMessages.push('The value must be an object.');
    return false;
  }

  return true;
};

/**
 * @param {TypeOptions} typeOptions
 * @return {boolean}
 */
ObjectType.prototype.validateFieldSpecification = function objectTypeValidateFieldSpecification (typeOptions) {
  return !(typeOptions.hasOwnProperty('strict') && typeof typeOptions.strict !== 'boolean');
};

/**
 * @param {TypeOptions} typeOptions
 * @param {boolean} parentStrictness
 * @return {boolean|TypeOptions}
 * @throws InternalError
 */
ObjectType.prototype.getStrictness = function objectTypeGetStrictness (typeOptions, parentStrictness) {
  if (!typeOptions.hasOwnProperty('strict')) {
    return parentStrictness;
  }

  return typeOptions.strict;
};

module.exports = ObjectType;
