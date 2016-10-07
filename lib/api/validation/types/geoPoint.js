var
  BaseConstructor = require('../baseType'),
  geoUtil = require('../../dsl/geoutil');

/**
 * @constructor
 */
function GeoPointType () {
  this.typeName = 'geo_point';
  this.allowChildren = false;
  this.allowedTypeOptions = [];
}

GeoPointType.prototype = new BaseConstructor();

/**
 * @param {TypeOptions} typeOptions
 * @param {*} fieldValue
 * @param {string[]} errorMessages
 */
GeoPointType.prototype.validate = function (typeOptions, fieldValue, errorMessages) {
  try {
    geoUtil.constructPoint(fieldValue);
  }
  catch(error) {
    errorMessages.push(error.message);
    return false;
  }

  return true;
};

/**
 * @return {boolean}
 */
GeoPointType.prototype.validateFieldSpecification = function () {
  return true;
};

module.exports = GeoPointType;