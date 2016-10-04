var
  BaseConstructor = require('../baseType');

/**
 * @constructor
 */
function EnumType () {
  this.typeName = 'enum';
  this.allowChildren = false;
}

EnumType.prototype = new BaseConstructor();

/**
 * @param {StructuredFieldSpecification} fieldSpecificationSubset
 * @param {*} fieldValue
 */
EnumType.prototype.validate = function (fieldSpecificationSubset, fieldValue) {
  // TODO
  return true;
};

/**
 * @param {FieldSpecification} fieldSpecification
 * @return {boolean|FieldSpecification}
 * @throws InternalError
 * @this EnumType
 */
EnumType.prototype.validateFieldSpecification = function (fieldSpecification) {
  // TODO
  return true;
};

module.exports = EnumType;