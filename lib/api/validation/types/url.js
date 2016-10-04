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
 * @param {StructuredFieldSpecification} fieldSpecificationSubset
 * @param {*} fieldValue
 */
UrlType.prototype.validate = function (fieldSpecificationSubset, fieldValue) {
  // TODO
  return true;
};

/**
 * @param {FieldSpecification} fieldSpecification
 * @return {boolean|FieldSpecification}
 * @throws InternalError
 * @this UrlType
 */
UrlType.prototype.validateFieldSpecification = function (fieldSpecification) {
  // TODO
  return true;
};

module.exports = UrlType;