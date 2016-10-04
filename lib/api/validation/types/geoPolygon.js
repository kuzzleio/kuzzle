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
 * @param {StructuredFieldSpecification} fieldSpecificationSubset
 * @param {*} fieldValue
 */
GeoPolygonType.prototype.validate = function (fieldSpecificationSubset, fieldValue) {
  // TODO
  return true;
};

/**
 * @param {FieldSpecification} fieldSpecification
 * @return {boolean|FieldSpecification}
 * @throws InternalError
 * @this GeoPolygonType
 */
GeoPolygonType.prototype.validateFieldSpecification = function (fieldSpecification) {
  // TODO
  return true;
};

module.exports = GeoPolygonType;