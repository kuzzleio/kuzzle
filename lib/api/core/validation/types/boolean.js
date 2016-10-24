var
  util = require('util'),
  BaseConstructor = require('../baseType');

/**
 * @constructor
 */
function BooleanType () {
  this.typeName = 'boolean';
  this.allowChildren = false;
  this.allowedTypeOptions = [];
}

util.inherits(BooleanType, BaseConstructor);

/**
 * @param {TypeOptions} typeOptions
 * @param {*} fieldValue
 * @param {string[]} errorMessages
 */
BooleanType.prototype.validate = function validate (typeOptions, fieldValue, errorMessages) {
  if (typeof fieldValue !== 'boolean') {
    errorMessages.push('The field must be of type boolean.');
    return false;
  }

  return true;
};

/**
 * @return {boolean}
 */
BooleanType.prototype.validateFieldSpecification = function validateFieldSpecification () {
  return true;
};

module.exports = BooleanType;