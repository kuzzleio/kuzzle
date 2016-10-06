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
 */
GeoPointType.prototype.validate = function (typeOptions, fieldValue) {
  try {
    geoUtil.constructPoint(fieldValue);
  }
  catch(error) {
    return false;
  }

  return true;
};

/**
 * @param {TypeOptions} typeOptions
 * @return {boolean|TypeOptions}
 * @throws InternalError
 */
GeoPointType.prototype.validateFieldSpecification = function () {
  return true;
};

module.exports = GeoPointType;