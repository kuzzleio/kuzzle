var
  util = require('util'),
  BaseConstructor = require('../baseType');

/**
 * @constructor
 */
function AnythingType () {
  this.typeName = 'anything';
  this.allowChildren = false;
  this.allowedTypeOptions = [];
}

util.inherits(AnythingType, BaseConstructor);

/**
 * @returns {boolean}
 */
AnythingType.prototype.validate = function anythingTypeValidate () {
  return true;
};

/**
 * @return {boolean}
 */
AnythingType.prototype.validateFieldSpecification = function anythingTypeValidateFieldSpecification () {
  return true;
};

module.exports = AnythingType;