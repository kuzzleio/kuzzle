var
  BaseConstructor = require('../baseType');

/**
 * @constructor
 */
function GeoPolygonType () {
  this.typeName = 'geo_polygon';
  this.allowChildren = false;
}

GeoPolygonType.prototype = new BaseConstructor();

/**
 * @param {StructuredFieldSpecification} fieldSpec
 * @param {*} fieldValue
 */
GeoPolygonType.prototype.validate = function (fieldSpec, fieldValue) {
  // TODO
  return true;
};

/**
 * @param {FieldSpecification} fieldSpec
 * @return {boolean|FieldSpecification}
 * @throws InternalError
 */
GeoPolygonType.prototype.validateFieldSpecification = function (fieldSpec) {
  return !(fieldSpec.hasOwnProperty('type_options') && Object.keys(fieldSpec.type_options).length > 0);
};

module.exports = GeoPolygonType;