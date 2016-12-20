/**
 * @constructor
 */
function BaseType () {

}

/**
 * Must be overrided for the validation type to be useful
 *
 * @return {boolean}
 */
BaseType.prototype.validate = function baseTypeValidate () {
  return true;
};

/**
 * Must be overrided if the type implements specific typeOptions
 *
 * @return {boolean}
 * @this IpAddressType
 */
BaseType.prototype.validateFieldSpecification = function baseTypeValidateFieldSpecification () {
  return true;
};


/**
 * @param {*} object
 * @param {string[]} allowedProperties
 * @returns {boolean}
 */
BaseType.prototype.checkAllowedProperties = function baseTypeCheckAllowedProperties (object, allowedProperties) {
  if (typeof object !== 'object' || Array.isArray(object) || object === null) {
    return false;
  }

  return !Object.keys(object).some(propertyName => allowedProperties.indexOf(propertyName) === -1);
};

/**
 * @param {StructuredFieldSpecification} fieldSpec
 * @param {boolean} parentStrictness
 * @return {boolean}
 */
BaseType.prototype.getStrictness = function baseTypeGetStrictness (fieldSpec, parentStrictness) {
  return parentStrictness;
};

module.exports = BaseType;