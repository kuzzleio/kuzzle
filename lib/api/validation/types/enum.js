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
 * @param {StructuredFieldSpecification} fieldSpec
 * @param {*} fieldValue
 */
EnumType.prototype.validate = function (fieldSpec, fieldValue) {
  // TODO
  return true;
};

/**
 * @param {FieldSpecification} fieldSpec
 * @return {boolean|FieldSpecification}
 * @throws InternalError
 */
EnumType.prototype.validateFieldSpecification = function (fieldSpec) {
  // TODO
  return true;
};

module.exports = EnumType;