var
  BaseConstructor = require('../baseType');

/**
 * @constructor
 */
function IntegerType () {
  this.typeName = 'integer';
  this.allowChildren = false;
}

IntegerType.prototype = new BaseConstructor();

/**
 * @param {StructuredFieldSpecification} fieldSpecificationSubset
 * @param {*} fieldValue
 */
IntegerType.prototype.validate = function (fieldSpecificationSubset, fieldValue) {
  // TODO
  return true;
};

/**
 * @param {FieldSpecification} fieldSpecification
 * @return {boolean|FieldSpecification}
 * @throws InternalError
 * @this IntegerType
 */
IntegerType.prototype.validateFieldSpecification = function (fieldSpecification) {
  // TODO
  return true;
};

module.exports = IntegerType;