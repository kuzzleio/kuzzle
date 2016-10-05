var
  BaseConstructor = require('../baseType'),
  allowedTypeOptions = ['length'],
  allowedLengthOptions = ['min', 'max'];

/**
 * @constructor
 */
function StringType () {
  this.typeName = 'string';
}

StringType.prototype = new BaseConstructor();

/**
 * @param {StructuredFieldSpecification} fieldSpec
 * @param {*} fieldValue
 */
StringType.prototype.validate = function (fieldSpec, fieldValue) {
  if (typeof fieldValue !== 'string') {
    return false;
  }

  return !(fieldSpec.type_options && fieldSpec.type_options.length && (fieldSpec.type_options.length.hasOwnProperty('min') && fieldValue.length < fieldSpec.type_options.length.min || fieldSpec.type_options.length.hasOwnProperty('max') && fieldValue.length > fieldSpec.type_options.length.max));
};

/**
 * @param {FieldSpecification} fieldSpec
 * @return {boolean|FieldSpecification}
 */
StringType.prototype.validateFieldSpecification = function (fieldSpec) {
  if (fieldSpec.hasOwnProperty('type_options') && !this.checkAllowedProperties(fieldSpec.type_options, allowedTypeOptions)) {
    return false;
  }

  if (fieldSpec.type_options.length && !this.checkAllowedProperties(fieldSpec.type_options.length, allowedLengthOptions)) {
    return false;
  }

  if (fieldSpec.type_options.length.hasOwnProperty('min') && fieldSpec.type_options.length.hasOwnProperty('max')) {
    return fieldSpec.type_options.length.max >= fieldSpec.type_options.length.min;
  }

  return true;
};

module.exports = StringType;