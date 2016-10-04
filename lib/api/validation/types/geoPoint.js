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
 * @param {StructuredFieldSpecification} fieldSpecificationSubset
 * @param {*} fieldValue
 */
GeoPointType.prototype.validate = function (fieldSpecificationSubset, fieldValue) {
  // TODO
  return true;
};

/**
 * @param {FieldSpecification} fieldSpecification
 * @return {boolean|FieldSpecification}
 * @throws InternalError
 * @this GeoPointType
 */
GeoPointType.prototype.validateFieldSpecification = function (fieldSpecification) {
  // TODO
  return true;
};

module.exports = GeoPointType;