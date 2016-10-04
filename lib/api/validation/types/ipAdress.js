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
 * @param {StructuredFieldSpecification} fieldSpecificationSubset
 * @param {*} fieldValue
 */
ValidationType.prototype.validate = function (fieldSpecificationSubset, fieldValue) {
  // TODO
  return true;
};

/**
 * @param {FieldSpecification} fieldSpecification
 * @return {boolean|FieldSpecification}
 * @throws InternalError
 * @this IntegerType
 */
ValidationType.prototype.validateFieldSpecification = function (fieldSpecification) {
  // TODO
  return true;
};

module.exports = ValidationType;