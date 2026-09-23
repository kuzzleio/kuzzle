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

/**
 * The coordinate predicates a GeoJSON-like shape is checked against.
 *
 * They are pure functions of a coordinate array, and they are the unit worth
 * testing directly: `geoShape.ts` uses `export =`, which cannot carry named
 * exports beside it, so the only way a spec could address them was `rewire`'s
 * `__get__` — and, from there, `__set__` to replace them in the module that
 * calls them (ADR-0001, step 13 L6g).
 */

export function isPoint(point: unknown): boolean {
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
export function isPointEqual(pointA: unknown[], pointB: unknown[]): boolean {
  return pointA[0] === pointB[0] && pointA[1] === pointB[1];
}
export function isLine(line: unknown): boolean {
  if (!Array.isArray(line) || line.length < 2) {
    return false;
  }

  return line.every((point) => isPoint(point));
}
export function isPolygonPart(polygonPart: unknown): boolean {
  return (
    Array.isArray(polygonPart) &&
    polygonPart.length >= 4 &&
    isLine(polygonPart) &&
    isPointEqual(polygonPart[0], polygonPart.at(-1))
  );
}
export function isPolygon(polygon: unknown): boolean {
  if (!Array.isArray(polygon)) {
    return false;
  }

  return polygon.every((polygonPart) => isPolygonPart(polygonPart));
}
export function isEnvelope(envelope: unknown): boolean {
  if (!Array.isArray(envelope) || envelope.length !== 2) {
    return false;
  }

  return isPoint(envelope[0]) && isPoint(envelope[1]);
}
