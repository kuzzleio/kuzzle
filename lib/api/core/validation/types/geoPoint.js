var
  util = require('util'),
  BaseConstructor = require('../baseType'),
  convertGeopoint = require('../../../dsl/util/convertGeopoint');

/**
 * @constructor
 */
function GeoPointType () {
  this.typeName = 'geo_point';
  this.allowChildren = false;
  this.allowedTypeOptions = [];
}

util.inherits(GeoPointType, BaseConstructor);

/**
 * @param {TypeOptions} typeOptions
 * @param {*} fieldValue
 * @param {string[]} errorMessages
 */
GeoPointType.prototype.validate = function geoPointTypeValidate (typeOptions, fieldValue, errorMessages) {
  if (convertGeopoint(fieldValue) === null) {
    errorMessages.push('Invalid GeoPoint format');
    return false;
  }

  return true;
};

/**
 * @return {boolean}
 */
GeoPointType.prototype.validateFieldSpecification = function geoPointTypeValidateFieldSpecification () {
  return true;
};

module.exports = GeoPointType;