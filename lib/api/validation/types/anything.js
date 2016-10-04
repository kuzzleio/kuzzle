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
 * @param {FieldSpecification} fieldSpecification
 * @return {boolean|FieldSpecification}
 * @throws InternalError
 * @this AnythingType
 */
AnythingType.prototype.validateFieldSpecification = function (fieldSpecification) {
  return !(fieldSpecification.hasOwnProperty('type_options') && Object.keys(fieldSpecification.type_options).length > 0);
};

module.exports = AnythingType;