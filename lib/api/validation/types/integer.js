var
  BaseConstructor = require('../baseType'),
  allowedTypeOptions = ['range'],
  allowedRangeOptions = ['min', 'max'];

/**
 * @constructor
 */
function IntegerType () {
  this.typeName = 'integer';
  this.allowChildren = false;
}

IntegerType.prototype = new BaseConstructor();

/**
 * @param {StructuredFieldSpecification} fieldSpec
 * @param {*} fieldValue
 */
IntegerType.prototype.validate = function (fieldSpec, fieldValue) {
  if (typeof fieldValue !== 'number' || !Number.isInteger(fieldValue)) {
    return false;
  }

  return !(fieldSpec.type_options && fieldSpec.type_options.range && (fieldSpec.type_options.range.hasOwnProperty('min') && fieldValue < fieldSpec.type_options.range.min || fieldSpec.type_options.range.hasOwnProperty('max') && fieldValue > fieldSpec.type_options.range.max));
};

/**
 * @param {FieldSpecification} fieldSpec
 * @return {boolean|FieldSpecification}
 * @throws InternalError
 */
IntegerType.prototype.validateFieldSpecification = function (fieldSpec) {
  if (fieldSpec.hasOwnProperty('type_options') && !this.checkAllowedProperties(fieldSpec.type_options, allowedTypeOptions)) {
    return false;
  }

  if (fieldSpec.type_options.range && !this.checkAllowedProperties(fieldSpec.type_options.range, allowedRangeOptions)) {
    return false;
  }

  if (fieldSpec.type_options.range.hasOwnProperty('min') && fieldSpec.type_options.range.hasOwnProperty('max')) {
    return fieldSpec.type_options.range.max >= fieldSpec.type_options.range.min;
  }

  return true;
};

module.exports = IntegerType;