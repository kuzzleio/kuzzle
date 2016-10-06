var
  BaseConstructor = require('../baseType');

/**
 * @constructor
 */
function AnythingType () {
  this.typeName = 'anything';
  this.allowChildren = false;
  this.allowedTypeOptions = [];
}

AnythingType.prototype = new BaseConstructor();

AnythingType.prototype.validate = function () {
  return true;
};

/**
 * @param {TypeOptions} typeOptions
 * @return {boolean|TypeOptions}
 * @throws InternalError
 */
AnythingType.prototype.validateFieldSpecification = function () {
  return true;
};

module.exports = AnythingType;