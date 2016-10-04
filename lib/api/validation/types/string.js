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
 * @param {StructuredFieldSpecification} fieldSpecSubset
 * @param {*} fieldValue
 */
StringType.prototype.validate = function (fieldSpecSubset, fieldValue) {
  if (typeof fieldValue !== 'string') {
    return false;
  }

  return !(fieldSpecSubset.type_options && fieldSpecSubset.type_options.length && (fieldSpecSubset.type_options.length.hasOwnProperty('min') && fieldValue.length < fieldSpecSubset.type_options.length.min || fieldSpecSubset.type_options.length.hasOwnProperty('max') && fieldValue.length > fieldSpecSubset.type_options.length.max));
};

/**
 * @param {FieldSpecification} fieldSpec
 * @return {boolean|FieldSpecification}
 * @this EmailType
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