var
  BaseConstructor = require('../baseType');

/**
 * @constructor
 */
function EmailType () {
  this.typeName = 'email';
  this.allowChildren = false;
}

EmailType.prototype = new BaseConstructor();

/**
 * @param {StructuredFieldSpecification} fieldSpec
 * @param {*} fieldValue
 */
EmailType.prototype.validate = function (fieldSpec, fieldValue) {
  // TODO
  return true;
};

/**
 * @param {FieldSpecification} fieldSpec
 * @return {boolean|FieldSpecification}
 * @throws InternalError
 */
EmailType.prototype.validateFieldSpecification = function (fieldSpec) {
  // TODO
  return true;
};

module.exports = EmailType;