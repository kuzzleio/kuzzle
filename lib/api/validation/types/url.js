var
  BaseConstructor = require('../baseType');

/**
 * @constructor
 */
function UrlType () {
  this.typeName = 'url';
  this.allowChildren = false;
}

UrlType.prototype = new BaseConstructor();

/**
 * @param {StructuredFieldSpecification} fieldSpec
 * @param {*} fieldValue
 */
UrlType.prototype.validate = function (fieldSpec, fieldValue) {
  // TODO
  return true;
};

/**
 * @param {FieldSpecification} fieldSpec
 * @return {boolean|FieldSpecification}
 * @throws InternalError
 */
UrlType.prototype.validateFieldSpecification = function (fieldSpec) {
  // TODO
  return true;
};

module.exports = UrlType;