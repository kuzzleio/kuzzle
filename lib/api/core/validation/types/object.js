var
  util = require('util'),
  BaseConstructor = require('../baseType');

/**
 * @constructor
 */
function ObjectType () {
  this.typeName = 'object';
  this.allowChildren = true;
  this.allowedTypeOptions = ['strict'];
}

util.inherits(ObjectType, BaseConstructor);

/**
 * @returns {boolean}
 */
ObjectType.prototype.validate = function () {
  // Validation of a plain object is assured by the core validation process
  return true;
};

/**
 * @param {TypeOptions} typeOptions
 * @return {boolean}
 */
ObjectType.prototype.validateFieldSpecification = function (typeOptions) {
  return !(typeOptions.hasOwnProperty('strict') && typeof typeOptions.strict !== 'boolean');
};

/**
 * @param {TypeOptions} typeOptions
 * @param {boolean} parentStrictness
 * @return {boolean|TypeOptions}
 * @throws InternalError
 */
ObjectType.prototype.getStrictness = function (typeOptions, parentStrictness) {
  if (!typeOptions.hasOwnProperty('strict')) {
    return parentStrictness;
  }

  return typeOptions.strict;
};

module.exports = ObjectType;
