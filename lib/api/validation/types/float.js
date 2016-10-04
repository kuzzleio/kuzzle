var
  BaseConstructor = require('../baseType');

/**
 * @constructor
 */
function FloatType () {
  this.typeName = 'float';
  this.allowChildren = false;
}

FloatType.prototype = new BaseConstructor();

/**
 * @param {StructuredFieldSpecification} fieldSpecificationSubset
 * @param {*} fieldValue
 */
FloatType.prototype.validate = function (fieldSpecificationSubset, fieldValue) {
  // TODO
  return true;
};

/**
 * @param {FieldSpecification} fieldSpecification
 * @return {boolean|FieldSpecification}
 * @throws InternalError
 * @this FloatType
 */
FloatType.prototype.validateFieldSpecification = function (fieldSpecification) {
  // TODO
  return true;
};

module.exports = FloatType;