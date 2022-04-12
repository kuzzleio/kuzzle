/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const { Koncorde } = require('koncorde');

const kerror = require('../../../kerror');
const BaseType = require('../baseType');

const
  allowedShapeProperties = [
    'type',
    'coordinates',
    'radius',
    'orientation',
    'geometries'
  ],
  allowedOrientations = [
    'right',
    'ccw',
    'counterclockwise',
    'left',
    'cw',
    'clockwise'
  ],
  multiTypes = [
    'multipoint',
    'multilinestring',
    'multipolygon'
  ],
  allowedShapeTypes = [
    'point',
    'linestring',
    'polygon',
    'multipoint',
    'multilinestring',
    'multipolygon',
    'geometrycollection',
    'envelope',
    'circle'
  ];

/**
 * @class GeoShapeType
 */
class GeoShapeType extends BaseType {
  constructor () {
    super();
    this.typeName = 'geo_shape';
    this.allowChildren = false;
    this.allowedTypeOptions = ['shapeTypes'];
  }

  /**
   * @param {TypeOptions} typeOptions
   * @param {GeoShape} fieldValue
   * @param {string[]} errorMessages
   * @returns {boolean}
   */
  validate (typeOptions, fieldValue, errorMessages) {
    return this.recursiveShapeValidation(
      typeOptions.shapeTypes,
      fieldValue,
      errorMessages
    );
  }

  /**
   * @param {string[]} allowedShapes
   * @param {GeoShape} shape
   * @param {string[]} errorMessages
   * @returns {boolean}
   */
  recursiveShapeValidation (allowedShapes, shape, errorMessages) {
    if (! this.checkStructure(allowedShapes, shape, errorMessages)) {
      return false;
    }

    const isMulti = multiTypes.indexOf(shape.type) !== -1;
    let
      coordinateValidation,
      result = true;

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
        if (shape.orientation
          && ! allowedOrientations.includes(shape.orientation)
        ) {
          errorMessages.push('The orientation property has not a valid value.');
          result = false;
        }
        break;
      case 'geometrycollection':
        coordinateValidation = () => true;

        for (let i = 0; i < shape.geometries.length; i++) {
          if (! this.recursiveShapeValidation(
            allowedShapes,
            shape.geometries[i],
            errorMessages)
          ) {
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
            if (typeof Koncorde.convertDistance(shape.radius) !== 'number') {
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
      default:
        // added to comply with sonarqube
        // but it's currently not possible to get here
        errorMessages.push(`Unrecognized shape: ${shape.type}`);
        result = false;
    }

    if (isMulti) {
      if (shape.coordinates.some(
        coordinate => ! coordinateValidation(coordinate)
      )) {
        errorMessages.push(
          `One of the shapes in  the shape type "${shape.type}" has bad coordinates.`
        );
        result = false;
      }
    }
    else if (! coordinateValidation(shape.coordinates)) {
      errorMessages.push(`The shape type "${shape.type}" has bad coordinates.`);
      return false;
    }

    return result;
  }

  /**
   * @param {string[]} allowedShapes
   * @param {GeoShape} shape
   * @param {string[]} errorMessages
   * @returns {boolean}
   */
  checkStructure (allowedShapes, shape, errorMessages) {
    let result = true;

    if (! shape.type) {
      errorMessages.push('The shape object has no type defined.');
      return false;
    }

    if (! this.checkAllowedProperties(shape, allowedShapeProperties)) {
      errorMessages.push('The shape object has a not allowed property.');
      result = false;
    }

    if (allowedShapes.indexOf(shape.type) === -1) {
      errorMessages.push('The provided shape type is not allowed.');
      result = false;
    }

    if (shape.type === 'geometrycollection' && shape.coordinates) {
      errorMessages.push('The coordinates property must not be provided for the "geometrycollection" shape type.');
      result = false;
    }

    if (shape.type !== 'geometrycollection'
      && (! shape.coordinates || ! Array.isArray(shape.coordinates)
      )) {
      errorMessages.push(`The coordinates property must be provided for the "${shape.type}" shape type.`);
      result = false;
    }

    if (shape.type === 'circle' && ! shape.radius) {
      errorMessages.push('The radius property is mandatory for the "circle" shape type.');
      result = false;
    }

    if (shape.type !== 'circle' && shape.radius) {
      errorMessages.push(`The radius property must not be provided for the "${shape.type}" shape type.`);
      result = false;
    }

    if (shape.type !== 'polygon'
      && shape.type !== 'multipolygon'
      && shape.orientation
    ) {
      errorMessages.push(`The orientation property must not be provided for the "${shape.type}" shape type.`);
      result = false;
    }

    if (shape.type !== 'geometrycollection' && shape.geometries) {
      errorMessages.push(`The geometries property must not be provided for the "${shape.type}" shape type.`);
      result = false;
    }

    if (shape.type === 'geometrycollection'
      && (! shape.geometries || ! Array.isArray(shape.geometries)
      )) {
      errorMessages.push('The geometries property must be provided for the "geometrycollection" shape type.');
      result = false;
    }

    return result;
  }

  /**
   * @param {TypeOptions} typeOptions
   * @returns {TypeOptions}
   * @throws {PreconditionError}
   */
  validateFieldSpecification (typeOptions) {
    if (Object.prototype.hasOwnProperty.call(typeOptions, 'shapeTypes')) {
      if (! Array.isArray(typeOptions.shapeTypes)
        || typeOptions.shapeTypes.length === 0
      ) {
        throw kerror.get('validation', 'assert', 'invalid_type', 'shapeTypes', 'string[]');
      }

      const invalid = typeOptions.shapeTypes.filter(
        shape => ! allowedShapeTypes.includes(shape));

      if (invalid.length > 0) {
        throw kerror.get('validation', 'types', 'invalid_geoshape', invalid);
      }
    }
    else {
      typeOptions.shapeTypes = allowedShapeTypes;
    }

    return typeOptions;
  }
}

/**
 * @param {GeoShapePointCoordinates} point
 * @returns {boolean}
 */
function isPoint (point) {
  if (! Array.isArray(point) || point.length !== 2) {
    return false;
  }

  return ! (
    point[0] < -180
    || point[0] > 180
    || point[1] < -90
    || point[1] > 90);
}

/**
 * @param {GeoShapePointCoordinates} pointA
 * @param {GeoShapePointCoordinates} pointB
 * @returns {boolean}
 */
function isPointEqual (pointA, pointB) {
  return pointA[0] === pointB[0] && pointA[1] === pointB[1];
}

/**
 * @param {GeoShapeLineCoordinates} line
 * @returns {boolean}
 */
function isLine (line) {
  if (! Array.isArray(line) || line.length < 2) {
    return false;
  }

  return line.every(point => isPoint(point));
}

/**
 * @param {GeoShapePolygonPart} polygonPart
 * @returns {boolean}
 */
function isPolygonPart (polygonPart) {
  return Array.isArray(polygonPart)
    && polygonPart.length >= 4
    && isLine(polygonPart)
    && isPointEqual(polygonPart[0], polygonPart[polygonPart.length - 1]);
}

/**
 * @param {GeoShapePolygon} polygon
 * @returns {boolean}
 */
function isPolygon (polygon) {
  if (! Array.isArray(polygon)) {
    return false;
  }

  return polygon.every(polygonPart => isPolygonPart(polygonPart));
}

function isEnvelope (envelope) {
  if (! Array.isArray(envelope) || envelope.length !== 2) {
    return false;
  }

  return isPoint(envelope[0]) && isPoint(envelope[1]);
}

module.exports = GeoShapeType;
