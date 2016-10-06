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
 */
MyNewType.prototype.validate = function (typeOptions, fieldValue) {
  return typeof fieldValue === 'boolean';
};

/**
 * @param {TypeOptions} typeOptions
 * @return {boolean|TypeOptions}
 * @throws InternalError
 */
MyNewType.prototype.validateFieldSpecification = function () {
  return true;
};

module.exports = MyNewType;