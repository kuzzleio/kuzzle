var
  BaseConstructor = require('../baseType');

/**
 * @constructor
 */
function MyNewType () {
  this.typeName = 'boolean';
  this.allowChildren = false;
  this.allowedTypeOptions = [];
}

MyNewType.prototype = new BaseConstructor();

/**
 * @param {TypeOptions} typeOptions
 * @param {*} fieldValue
 * @param {string[]} errorMessages
 */
MyNewType.prototype.validate = function (typeOptions, fieldValue, errorMessages) {
  if (typeof fieldValue !== 'boolean') {
    errorMessages.push('The field must be of type boolean.');
    return false;
  }

  return true;
};

/**
 * @return {boolean}
 */
MyNewType.prototype.validateFieldSpecification = function () {
  return true;
};

module.exports = MyNewType;