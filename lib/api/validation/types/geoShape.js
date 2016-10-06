var
  BaseConstructor = require('../baseType'),
  allowedShapeProperties = ['type', 'coordinates', 'radius', 'orientation', 'geometries'],
  allowedOrientations = ['right', 'ccw', 'counterclockwise', 'left', 'cw', 'clockwise'],
  mutliTypes = ['multipoint', 'multilinestring', 'multipolygon'],
  geoUtils = require('../../dsl/geoutil'),
  allowedShapeTypes = ['point', 'linestring', 'polygon', 'multipoint', 'multilinestring', 'multipolygon', 'geometrycollection', 'envelope', 'circle'];

/**
 * @constructor
 */
function GeoShapeType () {
  this.typeName = 'geo_shape';
  this.allowChildren = false;
  this.allowedTypeOptions = ['shapeTypes'];
}

GeoShapeType.prototype = new BaseConstructor();

/**
 * @param {TypeOptions} typeOptions
 * @param {*} fieldValue
 */
GeoShapeType.prototype.validate = function (typeOptions, fieldValue) {
  return this.recursiveShapeValidation(typeOptions.shapeTypes, fieldValue);
};

GeoShapeType.prototype.recursiveShapeValidation = function (allowedShapes, shape) {
  var
    isMulti,
    coordinateValidation;

  if (!this.checkStructure(allowedShapes, shape)) {
    return false;
  }
  
  isMulti = mutliTypes.indexOf(shape.type) !== -1;
  
  switch (shape.type) {
    case 'point':
    case 'multipoint':
      coordinateValidation = coordinate => checkPoint(coordinate);
      break;
    case 'linestring':
    case 'multilinestring':
      coordinateValidation = coordinate => checkPoint(coordinate);
      break;
    case 'polygon':
    case 'multipolygon':
      break;
    case 'geometrycollection':
      break;
    case 'envelope':
      break;
    case 'circle':
      break;
  }

  return true;
};

GeoShapeType.prototype.checkStructure = function (allowedShapes, shape) {
  if (!this.checkAllowedProperties(shape, allowedShapeProperties) || !shape.type || allowedShapes.indexOf(shape.type) === -1) {
    return false;
  }

  if (shape.coordinates && shape.type === 'geometrycollection' && !Array.isArray(shape.coordinates) || !shape.coordinates && shape.type !== 'geometrycollection') {
    return false;
  }

  if (shape.radius && shape.type !== 'circle' || shape.type === 'circle' && !shape.radius) {
    return false;
  }

  if (shape.geometries && shape.type !== 'geometrycollection' || shape.type === 'geometrycollection' && !shape.geometries) {
    return false;
  }

  return true;
};

/**
 * @param {TypeOptions} typeOptions
 * @return {boolean|TypeOptions}
 * @throws InternalError
 */
GeoShapeType.prototype.validateFieldSpecification = function (typeOptions) {
  var result = true;

  if (typeOptions.hasOwnProperty('shapeTypes')) {
    if (!Array.isArray(typeOptions.shapeTypes) || typeOptions.shapeTypes.length === 0) {
      return false;
    }

    typeOptions.shapeTypes.forEach(shape => {
      if (allowedShapeTypes.indexOf(shape) === -1) {
        result = false;
      }
    });

    if (!result) {
      return false;
    }
  }
  else {
    typeOptions.shapeTypes = allowedShapeTypes;
  }

  return typeOptions;
};

/**
 * @param {Number[]} point
 * @returns {boolean}
 */
function checkPoint (point) {
  if (!Array.isArray(point) || point.length !== 2) {
    return false;
  }

  return !(point[0] < -180 || point[0] > 180 || point[1] < -90 || point[1] > 90);
}

module.exports = GeoShapeType;