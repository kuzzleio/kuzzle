var
  BaseConstructor = require('../baseType');

/**
 * @constructor
 */
function BooleanType () {
  this.typeName = 'boolean';
  this.allowChildren = false;
  this.allowedTypeOptions = [];
}

BooleanType.prototype = new BaseConstructor();

/**
 * @param {TypeOptions} typeOptions
 * @param {*} fieldValue
 * @param {string[]} errorMessages
 */
BooleanType.prototype.validate = function (typeOptions, fieldValue, errorMessages) {
  if (typeof fieldValue !== 'boolean') {
    errorMessages.push('The field must be of type boolean.');
    return false;
  }

  return true;
};

/**
 * @return {boolean}
 */
BooleanType.prototype.validateFieldSpecification = function () {
  return true;
};

module.exports = BooleanType;