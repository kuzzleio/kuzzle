var
  BaseConstructor = require('../baseType'),
  allowedRangeOptions = ['min', 'max'];

/**
 * @constructor
 */
function NumericType () {
  this.typeName = 'float';
  this.allowChildren = false;
  this.allowedTypeOptions = ['range'];
}

NumericType.prototype = new BaseConstructor();

/**
 * @param {TypeOptions} typeOptions
 * @param {*} fieldValue
 */
NumericType.prototype.validate = function (typeOptions, fieldValue) {
  if (typeof fieldValue !== 'number') {
    return false;
  }

  return !(typeOptions.range && (typeOptions.range.hasOwnProperty('min') && fieldValue < typeOptions.range.min || typeOptions.range.hasOwnProperty('max') && fieldValue > typeOptions.range.max));
};

/**
 * @param {TypeOptions} typeOptions
 * @return {boolean|TypeOptions}
 * @throws InternalError
 */
NumericType.prototype.validateFieldSpecification = function (typeOptions) {
  if (typeOptions.range && !this.checkAllowedProperties(typeOptions.range, allowedRangeOptions)) {
    return false;
  }

  if (typeOptions.range.hasOwnProperty('min') && typeOptions.range.hasOwnProperty('max')) {
    return typeOptions.range.max >= typeOptions.range.min;
  }

  return true;
};

module.exports = NumericType;