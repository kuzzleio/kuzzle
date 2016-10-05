var
  BaseConstructor = require('../baseType');

/**
 * @constructor
 */
function GeoPointType () {
  this.typeName = 'geo_point';
  this.allowChildren = false;
}

GeoPointType.prototype = new BaseConstructor();

/**
 * @param {StructuredFieldSpecification} fieldSpec
 * @param {*} fieldValue
 */
GeoPointType.prototype.validate = function (fieldSpec, fieldValue) {
  // TODO
  return true;
};

/**
 * @param {FieldSpecification} fieldSpec
 * @return {boolean|FieldSpecification}
 * @throws InternalError
 */
GeoPointType.prototype.validateFieldSpecification = function (fieldSpec) {
  return !(fieldSpec.hasOwnProperty('type_options') && Object.keys(fieldSpec.type_options).length > 0);
};

module.exports = GeoPointType;