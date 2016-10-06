var
  BaseConstructor = require('../baseType');

/**
 * @constructor
 */
function EnumType () {
  this.typeName = 'enum';
  this.allowChildren = false;
  this.allowedTypeOptions = ['values'];
}

EnumType.prototype = new BaseConstructor();

/**
 * @param {TypeOptions} typeOptions
 * @param {*} fieldValue
 */
EnumType.prototype.validate = function (typeOptions, fieldValue) {
  var result = false;

  if (typeof fieldValue !== 'string') {
    return false;
  }

  typeOptions.values.forEach(value => {
    if (fieldValue === value) {
      result = true;
    }
  });

  return result;
};

/**
 * @param {TypeOptions} typeOptions
 * @return {boolean|TypeOptions}
 * @throws InternalError
 */
EnumType.prototype.validateFieldSpecification = function (typeOptions) {
  var result = true;

  if (!typeOptions.hasOwnProperty('values') || !Array.isArray(typeOptions.values) || typeOptions.values.length === 0) {
    return false;
  }

  typeOptions.values.forEach(value => {
    if (typeof value !== 'string') {
      result = false;
    }
  });

  return result;
};

module.exports = EnumType;