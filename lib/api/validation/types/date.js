var
  BaseConstructor = require('../baseType');

/**
 * @constructor
 */
function DateType () {
  this.typeName = 'date';
  this.allowChildren = false;
}

DateType.prototype = new BaseConstructor();

/**
 * @param {StructuredFieldSpecification} fieldSpecificationSubset
 * @param {*} fieldValue
 */
DateType.prototype.validate = function (fieldSpecificationSubset, fieldValue) {
  // TODO
  return true;
};

/**
 * @param {FieldSpecification} fieldSpecification
 * @return {boolean|FieldSpecification}
 * @throws InternalError
 * @this DateType
 */
DateType.prototype.validateFieldSpecification = function (fieldSpecification) {
  // TODO
  return true;
};

module.exports = DateType;