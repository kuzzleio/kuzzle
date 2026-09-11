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

import { Koncorde } from "koncorde";

import * as kerror from "../../../kerror";
import BaseType from "../baseType";
import { GeoShapeTypeOptions } from "../typeOptions";

const allowedShapeProperties = [
    "type",
    "coordinates",
    "radius",
    "orientation",
    "geometries",
  ],
  allowedOrientations = [
    "right",
    "ccw",
    "counterclockwise",
    "left",
    "cw",
    "clockwise",
  ],
  multiTypes = ["multipoint", "multilinestring", "multipolygon"],
  allowedShapeTypes = [
    "point",
    "linestring",
    "polygon",
    "multipoint",
    "multilinestring",
    "multipolygon",
    "geometrycollection",
    "envelope",
    "circle",
  ];

/**
 * A GeoJSON-like shape, as the user submits it: nothing but `type` can be
 * assumed to be there, which is what `checkStructure` is for.
 */
interface GeoShape {
  type?: string;
  coordinates?: unknown[];
  radius?: string | number;
  orientation?: string;
  geometries?: GeoShape[];
}

type CoordinateValidation = (coordinates: unknown) => boolean;

class GeoShapeType extends BaseType<GeoShapeTypeOptions> {
  public typeName = "geo_shape";
  public allowChildren = false;
  public allowedTypeOptions = ["shapeTypes"];

  validate(
    typeOptions: GeoShapeTypeOptions,
    fieldValue: GeoShape,
    errorMessages: string[],
  ): boolean {
    return this.recursiveShapeValidation(
      typeOptions.shapeTypes ?? [],
      fieldValue,
      errorMessages,
    );
  }

  recursiveShapeValidation(
    allowedShapes: string[],
    shape: GeoShape,
    errorMessages: string[],
  ): boolean {
    if (!this.checkStructure(allowedShapes, shape, errorMessages)) {
      return false;
    }

    // checkStructure has just proven these three are there; the defaults only
    // exist to keep the destructuring total.
    const { type = "", coordinates = [], geometries = [] } = shape;

    const isMulti = multiTypes.indexOf(type) !== -1;
    // the default also covers "geometrycollection", which holds no coordinates
    // of its own, and the unreachable `default:` branch below
    let coordinateValidation: CoordinateValidation = () => true,
      result = true;

    switch (type) {
      case "point":
      case "multipoint":
        coordinateValidation = isPoint;
        break;
      case "linestring":
      case "multilinestring":
        coordinateValidation = isLine;
        break;
      case "polygon":
      case "multipolygon":
        coordinateValidation = isPolygon;
        result = checkOrientation(shape, errorMessages);
        break;
      case "geometrycollection":
        result = this.checkGeometries(allowedShapes, geometries, errorMessages);
        break;
      case "envelope":
        coordinateValidation = isEnvelope;
        break;
      case "circle":
        coordinateValidation = isPoint;
        result = checkRadius(shape, errorMessages);
        break;
      default:
        // added to comply with sonarqube
        // but it's currently not possible to get here
        errorMessages.push(`Unrecognized shape: ${type}`);
        result = false;
    }

    // evaluated before the `&&` so that its error message is pushed even when
    // the switch has already invalidated the shape
    const coordinatesOk = checkCoordinates(
      type,
      isMulti,
      coordinates,
      coordinateValidation,
      errorMessages,
    );

    return result && coordinatesOk;
  }

  private checkGeometries(
    allowedShapes: string[],
    geometries: GeoShape[],
    errorMessages: string[],
  ): boolean {
    let result = true;

    for (const geometry of geometries) {
      if (
        !this.recursiveShapeValidation(allowedShapes, geometry, errorMessages)
      ) {
        result = false;
      }
    }

    return result;
  }

  checkStructure(
    allowedShapes: string[],
    shape: GeoShape,
    errorMessages: string[],
  ): boolean {
    if (!shape.type) {
      errorMessages.push("The shape object has no type defined.");
      return false;
    }

    // every check pushes its own message, so none of them may be short-circuited
    const typeOk = this.checkShapeType(
      allowedShapes,
      shape,
      shape.type,
      errorMessages,
    );
    const propertiesOk = this.checkShapeProperties(shape, errorMessages);

    return typeOk && propertiesOk;
  }

  private checkShapeType(
    allowedShapes: string[],
    shape: GeoShape,
    type: string,
    errorMessages: string[],
  ): boolean {
    let result = true;

    if (!this.checkAllowedProperties(shape, allowedShapeProperties)) {
      errorMessages.push("The shape object has a not allowed property.");
      result = false;
    }

    if (allowedShapes.indexOf(type) === -1) {
      errorMessages.push("The provided shape type is not allowed.");
      result = false;
    }

    return result;
  }

  /**
   * Checks the properties each shape type does and does not accept.
   */
  private checkShapeProperties(
    shape: GeoShape,
    errorMessages: string[],
  ): boolean {
    let result = true;

    if (shape.type === "geometrycollection" && shape.coordinates) {
      errorMessages.push(
        'The coordinates property must not be provided for the "geometrycollection" shape type.',
      );
      result = false;
    }

    if (
      shape.type !== "geometrycollection" &&
      (!shape.coordinates || !Array.isArray(shape.coordinates))
    ) {
      errorMessages.push(
        `The coordinates property must be provided for the "${shape.type}" shape type.`,
      );
      result = false;
    }

    if (shape.type === "circle" && !shape.radius) {
      errorMessages.push(
        'The radius property is mandatory for the "circle" shape type.',
      );
      result = false;
    }

    if (shape.type !== "circle" && shape.radius) {
      errorMessages.push(
        `The radius property must not be provided for the "${shape.type}" shape type.`,
      );
      result = false;
    }

    if (
      shape.type !== "polygon" &&
      shape.type !== "multipolygon" &&
      shape.orientation
    ) {
      errorMessages.push(
        `The orientation property must not be provided for the "${shape.type}" shape type.`,
      );
      result = false;
    }

    if (shape.type !== "geometrycollection" && shape.geometries) {
      errorMessages.push(
        `The geometries property must not be provided for the "${shape.type}" shape type.`,
      );
      result = false;
    }

    if (
      shape.type === "geometrycollection" &&
      (!shape.geometries || !Array.isArray(shape.geometries))
    ) {
      errorMessages.push(
        'The geometries property must be provided for the "geometrycollection" shape type.',
      );
      result = false;
    }

    return result;
  }

  /**
   * @throws {PreconditionError}
   */
  validateFieldSpecification(
    typeOptions: GeoShapeTypeOptions,
  ): GeoShapeTypeOptions {
    if (Object.prototype.hasOwnProperty.call(typeOptions, "shapeTypes")) {
      const { shapeTypes } = typeOptions;

      if (!Array.isArray(shapeTypes) || shapeTypes.length === 0) {
        throw kerror.get(
          "validation",
          "assert",
          "invalid_type",
          "shapeTypes",
          "string[]",
        );
      }

      const invalid = shapeTypes.filter(
        (shape) => !allowedShapeTypes.includes(shape),
      );

      if (invalid.length > 0) {
        throw kerror.get("validation", "types", "invalid_geoshape", invalid);
      }
    } else {
      typeOptions.shapeTypes = allowedShapeTypes;
    }

    return typeOptions;
  }
}

function checkOrientation(shape: GeoShape, errorMessages: string[]): boolean {
  if (shape.orientation && !allowedOrientations.includes(shape.orientation)) {
    errorMessages.push("The orientation property has not a valid value.");
    return false;
  }

  return true;
}

function checkRadius(shape: GeoShape, errorMessages: string[]): boolean {
  let valid: boolean;

  if (typeof shape.radius === "string") {
    try {
      valid = typeof Koncorde.convertDistance(shape.radius) === "number";
    } catch (error) {
      // an unparseable distance is an invalid radius, like any other
      valid = false;
    }
  } else {
    valid = typeof shape.radius === "number";
  }

  if (!valid) {
    errorMessages.push("The radius property has not a valid format.");
  }

  return valid;
}

function checkCoordinates(
  type: string,
  isMulti: boolean,
  coordinates: unknown[],
  coordinateValidation: CoordinateValidation,
  errorMessages: string[],
): boolean {
  if (isMulti) {
    if (coordinates.some((coordinate) => !coordinateValidation(coordinate))) {
      errorMessages.push(
        `One of the shapes in  the shape type "${type}" has bad coordinates.`,
      );
      return false;
    }

    return true;
  }

  if (!coordinateValidation(coordinates)) {
    errorMessages.push(`The shape type "${type}" has bad coordinates.`);
    return false;
  }

  return true;
}

function isPoint(point: unknown): boolean {
  if (!Array.isArray(point) || point.length !== 2) {
    return false;
  }

  return !(
    point[0] < -180 ||
    point[0] > 180 ||
    point[1] < -90 ||
    point[1] > 90
  );
}

function isPointEqual(pointA: unknown[], pointB: unknown[]): boolean {
  return pointA[0] === pointB[0] && pointA[1] === pointB[1];
}

function isLine(line: unknown): boolean {
  if (!Array.isArray(line) || line.length < 2) {
    return false;
  }

  return line.every((point) => isPoint(point));
}

function isPolygonPart(polygonPart: unknown): boolean {
  return (
    Array.isArray(polygonPart) &&
    polygonPart.length >= 4 &&
    isLine(polygonPart) &&
    isPointEqual(polygonPart[0], polygonPart[polygonPart.length - 1])
  );
}

function isPolygon(polygon: unknown): boolean {
  if (!Array.isArray(polygon)) {
    return false;
  }

  return polygon.every((polygonPart) => isPolygonPart(polygonPart));
}

function isEnvelope(envelope: unknown): boolean {
  if (!Array.isArray(envelope) || envelope.length !== 2) {
    return false;
  }

  return isPoint(envelope[0]) && isPoint(envelope[1]);
}

export = GeoShapeType;
