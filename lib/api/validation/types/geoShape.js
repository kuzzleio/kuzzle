var
  BaseConstructor = require('../baseType');

/**
 * @constructor
 */
function GeoShapeType () {
  this.typeName = 'geo_shape';
  this.allowChildren = false;
  this.allowedTypeOptions = [];
}

GeoShapeType.prototype = new BaseConstructor();

/**
 * @param {TypeOptions} typeOptions
 * @param {*} fieldValue
 */
GeoShapeType.prototype.validate = function (typeOptions, fieldValue) {
  // TODO
  return true;
};

/**
 * @param {TypeOptions} typeOptions
 * @return {boolean|TypeOptions}
 * @throws InternalError
 */
GeoShapeType.prototype.validateFieldSpecification = function () {
  return true;
};

module.exports = GeoShapeType;