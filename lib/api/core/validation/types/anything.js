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
AnythingType.prototype.validate = function validate () {
  return true;
};

/**
 * @return {boolean}
 */
AnythingType.prototype.validateFieldSpecification = function validateFieldSpecification () {
  return true;
};

module.exports = AnythingType;