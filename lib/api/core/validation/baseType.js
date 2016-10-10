/**
 * @constructor
 */
function BaseType () {

}

/**
 * Must be overrided in order for the validation type to be useful
 *
 * @return {boolean}
 */
BaseType.prototype.validate = function () {
  return true;
};

/**
 * Must be overrided in order for the validation type to be useful
 *
 * @return {boolean}
 * @this IpAddressType
 */
BaseType.prototype.validateFieldSpecification = function () {
  return true;
};


/**
 * @param {*} object
 * @param {string[]} allowedProperties
 * @returns {boolean}
 */
BaseType.prototype.checkAllowedProperties = function (object, allowedProperties) {
  var result = true;

  if (typeof object !== 'object') {
    return false;
  }

  Object.keys(object).forEach(propertyName => {
    if (allowedProperties.indexOf(propertyName) === -1) {
      result = false;
      return false;
    }
  });

  return result;
};

/**
 * @param {StructuredFieldSpecification} fieldSpec
 * @param {boolean} parentStrictness
 * @return {boolean}
 */
BaseType.prototype.getStrictness = function (fieldSpec, parentStrictness) {
  return parentStrictness;
};

module.exports = BaseType;