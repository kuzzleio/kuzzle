var
  BaseConstructor = require('../baseType'),
  allowedShapeProperties = ['type', 'coordinates', 'radius', 'orientation', 'geometries'],
  allowedOrientations = ['right', 'ccw', 'counterclockwise', 'left', 'cw', 'clockwise'],
  mutliTypes = ['multipoint', 'multilinestring', 'multipolygon'],
  geoUtils = require('../../../dsl/geoutil'),
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
 * @param {GeoShape} fieldValue
 * @param {string[]} errorMessages
 */
GeoShapeType.prototype.validate = function (typeOptions, fieldValue, errorMessages) {
  return this.recursiveShapeValidation(typeOptions.shapeTypes, fieldValue, errorMessages);
};

/**
 * @param {string[]} allowedShapes
 * @param {GeoShape} shape
 * @param {string[]} errorMessages
 * @returns {boolean}
 */
GeoShapeType.prototype.recursiveShapeValidation = function (allowedShapes, shape, errorMessages) {
  var
    isMulti = mutliTypes.indexOf(shape.type) !== -1,
    coordinateValidation,
    result = true,
    i;

  if (!this.checkStructure(allowedShapes, shape, errorMessages)) {
    return false;
  }
  
  switch (shape.type) {
    case 'point':
    case 'multipoint':
      coordinateValidation = isPoint;
      break;
    case 'linestring':
    case 'multilinestring':
      coordinateValidation = isLine;
      break;
    case 'polygon':
    case 'multipolygon':
      coordinateValidation = isPolygon;
      if (shape.orientation && allowedOrientations.indexOf(shape.orientation) === -1) {
        errorMessages.push('The orientation property has not a valid value.');
        result = false;
      }
      break;
    case 'geometrycollection':
      coordinateValidation = () => true;
      if (!Array.isArray(shape.geometries)) {
        errorMessages.push('The geometries property must be an array.');
        return false;
      }

      for (i = 0; i < shape.geometries.length; i++) {
        if (!this.recursiveShapeValidation(allowedShapes, shape.geometries[i], errorMessages)) {
          result = false;
        }
      }
      break;
    case 'envelope':
      coordinateValidation = isEnvelope;
      break;
    case 'circle':
      coordinateValidation = isPoint;
      if (typeof shape.radius === 'string') {
        try {
          if (typeof geoUtils.getDistance(shape.radius) !== 'number') {
            errorMessages.push('The radius property has not a valid format.');
            result = false;
          }
        }
        catch (error) {
          errorMessages.push('The radius property has not a valid format.');
          result = false;
        }
      }
      else if (typeof shape.radius !== 'number') {
        errorMessages.push('The radius property has not a valid format.');
        result = false;
      }
      break;
  }

  if (isMulti) {
    shape.coordinates.forEach(coordinate => {
      if (!coordinateValidation(coordinate)) {
        result = false;
      }
    });
  }
  else {
    result = result && coordinateValidation(shape.coordinates);
  }

  return result;
};

/**
 * @param {string[]} allowedShapes
 * @param {GeoShape} shape
 * @param {string[]} errorMessages
 * @returns {boolean}
 */
GeoShapeType.prototype.checkStructure = function (allowedShapes, shape, errorMessages) {
  var result = true;
  if (!this.checkAllowedProperties(shape, allowedShapeProperties)) {
    errorMessages.push('The shape object has a not allowed property.');
    result = false;
  }

  if (!shape.type) {
    errorMessages.push('The shape object has no type defined.');
    result = false;
  }

  if (allowedShapes.indexOf(shape.type) === -1) {
    errorMessages.push('The provided shape type is not allowed.');
    result = false;
  }

  if (shape.coordinates && shape.type === 'geometrycollection' && !Array.isArray(shape.coordinates)) {
    errorMessages.push('The coordinates property must not be provided for the "geometrycollection" shape type.');
    result = false;
  }

  if (!shape.coordinates && shape.type !== 'geometrycollection') {
    errorMessages.push(`The coordinates property must be provided for the "${shape.type}" shape type.`);
    result = false;
  }

  if (shape.type === 'circle' && !shape.radius) {
    errorMessages.push('The radius property is mandatory for the "circle" shape type.');
    result = false;
  }

  if (shape.radius && shape.type !== 'circle') {
    errorMessages.push(`The radius property must not be provided for the "${shape.type}" shape type.`);
    result = false;
  }

  if (shape.orientation && shape.type !== 'polygon' && shape.type !== 'multipolygon') {
    errorMessages.push(`The orientation property must not be provided for the "${shape.type}" shape type.`);
    result = false;
  }

  if (shape.geometries && shape.type !== 'geometrycollection') {
    errorMessages.push(`The geometries property must not be provided for the "${shape.type}" shape type.`);
    result = false;
  }

  if (shape.type === 'geometrycollection' && !shape.geometries) {
    errorMessages.push('The geometries property must be provided for the "geometrycollection" shape type.');
    result = false;
  }

  return result;
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
 * @param {GeoShapePointCoordinates} point
 * @returns {boolean}
 */
function isPoint (point) {
  if (!Array.isArray(point) || point.length !== 2) {
    return false;
  }

  return !(point[0] < -180 || point[0] > 180 || point[1] < -90 || point[1] > 90);
}

/**
 * @param {GeoShapePointCoordinates} pointA
 * @param {GeoShapePointCoordinates} pointB
 * @returns {boolean}
 */
function isPointEqual(pointA, pointB) {
  return (pointA[0] === pointB[0] && pointA[1] === pointB[1]);
}

/**
 * @param {GeoShapeLineCoordinates} line
 * @returns {boolean}
 */
function isLine (line) {
  var result = true;

  if (!Array.isArray(line) && line.length >= 2) {
    return false;
  }

  line.forEach(point => {
    if (!isPoint(point)) {
      result = false;
    }
  });

  return result;
}

/**
 * @param {GeoShapePolygonPart} polygonPart
 * @returns {boolean}
 */
function isPolygonPart (polygonPart) {
  return Array.isArray(polygonPart) && polygonPart.length >= 4 && isLine(polygonPart) && isPointEqual(polygonPart[0], polygonPart[polygonPart.length - 1]);
}

/**
 * @param {GeoShapePolygon} polygon
 * @returns {boolean}
 */
function isPolygon (polygon) {
  var result = true;

  if (!Array.isArray(polygon)) {
    return false;
  }

  polygon.forEach(polygonPart => {
    if (!isPolygonPart(polygonPart)) {
      result = false;
    }
  });

  return result;
}

function isEnvelope (envelope) {
  if (!Array.isArray(envelope) || envelope.length !== 2) {
    return false;
  }

  return isPoint(envelope[0]) && isPoint(envelope[1]);
}

module.exports = GeoShapeType;