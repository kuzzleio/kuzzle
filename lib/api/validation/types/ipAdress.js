var
  BaseConstructor = require('../baseType');

/**
 * @constructor
 */
function ValidationType () {
  this.typeName = 'ip_address';
  this.allowChildren = false;
}

ValidationType.prototype = new BaseConstructor();

/**
 * @param {StructuredFieldSpecification} fieldSpec
 * @param {*} fieldValue
 */
ValidationType.prototype.validate = function (fieldSpec, fieldValue) {
  // TODO
  return true;
};

/**
 * @param {FieldSpecification} fieldSpec
 * @return {boolean|FieldSpecification}
 * @throws InternalError
 */
ValidationType.prototype.validateFieldSpecification = function (fieldSpec) {
  // TODO
  return true;
};

module.exports = ValidationType;