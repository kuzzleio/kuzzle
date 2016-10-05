var
  BaseConstructor = require('../baseType'),
  allowedTypeOptions = ['strict'];

/**
 * @constructor
 */
function ObjectType () {
  this.typeName = 'object';
  this.allowChildren = true;
}

ObjectType.prototype = new BaseConstructor();

/**
 * @returns {boolean}
 */
ObjectType.prototype.validate = function () {
  // Validation of a plain object is assured by the core validation process
  return true;
};

/**
 * @param {FieldSpecification} fieldSpec
 * @return {boolean}
 */
ObjectType.prototype.validateFieldSpecification = function (fieldSpec) {
  return !(fieldSpec.hasOwnProperty('type_options')
    && (!this.checkAllowedProperties(fieldSpec.type_options, allowedTypeOptions)
    || typeof fieldSpec.type_options.strict !== 'boolean'));
};

/**
 * @param {StructuredFieldSpecification} fieldSpec
 * @param {boolean} parentStrictness
 * @return {boolean}
 */
ObjectType.prototype.getStrictness = function (fieldSpec, parentStrictness) {
  if (!fieldSpec.hasOwnProperty('type_options') || !fieldSpec.type_options.hasOwnProperty('strict')) {
    return parentStrictness;
  }

  return fieldSpec.type_options.strict;
};

module.exports = ObjectType;
