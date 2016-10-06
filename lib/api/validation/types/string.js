var
  BaseConstructor = require('../baseType'),
  allowedLengthOptions = ['min', 'max'];

/**
 * @constructor
 */
function StringType () {
  this.typeName = 'string';
  this.allowChildren = false;
  this.allowedTypeOptions = ['length'];
}

StringType.prototype = new BaseConstructor();

/**
 * @param {TypeOptions} typeOptions
 * @param {*} fieldValue
 */
StringType.prototype.validate = function (typeOptions, fieldValue) {
  if (typeof fieldValue !== 'string') {
    return false;
  }

  return !(typeOptions.length && (typeOptions.length.hasOwnProperty('min') && fieldValue.length < typeOptions.length.min || typeOptions.length.hasOwnProperty('max') && fieldValue.length > typeOptions.length.max));
};

/**
 * @param {TypeOptions} typeOptions
 * @return {boolean|TypeOptions}
 * @throws InternalError
 */
StringType.prototype.validateFieldSpecification = function (typeOptions) {
  if (typeOptions.length && !this.checkAllowedProperties(typeOptions.length, allowedLengthOptions)) {
    return false;
  }

  if (typeOptions.length.hasOwnProperty('min') && typeOptions.length.hasOwnProperty('max')) {
    return typeOptions.length.max >= typeOptions.length.min;
  }

  return true;
};

module.exports = StringType;