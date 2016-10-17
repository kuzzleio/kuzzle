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
AnythingType.prototype.validate = function () {
  return true;
};

/**
 * @return {boolean}
 */
AnythingType.prototype.validateFieldSpecification = function () {
  return true;
};

module.exports = AnythingType;