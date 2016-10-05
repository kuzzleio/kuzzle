var
  BaseConstructor = require('../baseType');

/**
 * @constructor
 */
function AnythingType () {
  this.typeName = 'anything';
  this.allowChildren = false;
}

AnythingType.prototype = new BaseConstructor();

AnythingType.prototype.validate = function () {
  return true;
};

/**
 * @param {FieldSpecification} fieldSpec
 * @return {boolean|FieldSpecification}
 * @throws InternalError
 */
AnythingType.prototype.validateFieldSpecification = function (fieldSpec) {
  return !(fieldSpec.hasOwnProperty('type_options') && Object.keys(fieldSpec.type_options).length > 0);
};

module.exports = AnythingType;