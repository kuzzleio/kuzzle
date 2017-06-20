/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
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
 * @typedef {{
 *   validate: Function,
 *   validateFieldSpecification: Function,
 *   typeName: string,
 *   allowChildren: boolean,
 *   checkAllowedProperties: Function,
 *   allowedTypeOptions: string[],
 *   getStrictness: Function
 * }} ValidationType
 */

/**
 * @typedef {{
 *   mandatory: boolean,
 *   type: string,
 *   defaultValue: *,
 *   multivalued: {
 *     value: boolean,
 *     minCount: number,
 *     maxCount: number
 *   },
 *   typeOptions: TypeOptions
 * }} FieldSpecification
 */

/**
 * @typedef {{
 *   mandatory: boolean,
 *   type: string,
 *   path: string[],
 *   depth: number,
 *   defaultValue: *,
 *   multivalued: {
 *     value: boolean,
 *     minCount: number,
 *     maxCount: number
 *   },
 *   typeOptions: TypeOptions,
 *   children: ...StructuredFieldSpecification
 * }} StructuredFieldSpecification
 */

/**
 * @typedef {{
 *   range: {
 *     min: number|string|Moment,
 *     max: number|string|Moment
 *   },
 *   length: {
 *     min: number,
 *     max: number
 *   },
 *   notEmpty: boolean,
 *   strict: boolean,
 *   values: string[],
 *   formats: string[],
 *   shapeTypes: string[]
 * }} TypeOptions
 */

/**
 * @typedef {{
 *   strict: boolean,
 *   fields: ...FieldSpecification,
 *   validators: *
 * }} CollectionSpecification
 */

/**
 * @typedef {{
 *  ...CollectionSpecification
 * }} IndexSpecification
 */

/**
 * @typedef {{
 *  ...IndexSpecification
 * }} DocumentSpecification
 */

/**
 * @typedef {Number[]} GeoShapePointCoordinates
 */

/**
 * @typedef {GeoShapePointCoordinates[]} GeoShapeEnvelopeCoordinates
 */

/**
 * @typedef {GeoShapePointCoordinates[]} GeoShapeLineCoordinates
 */

/**
 * @typedef {GeoShapePointCoordinates[]} GeoShapePolygonPart
 */

/**
 * @typedef {GeoShapePolygonPart[]} GeoShapePolygon
 */

/**
 * @typedef {{
 *   type: string,
 *   coordinates: GeoShapePointCoordinates|GeoShapeEnvelopeCoordinates|GeoShapeLineCoordinates|GeoShapePolygonPart|GeoShapePolygon,
 *   radius: string,
 *   orientation: string,
 *   geometries: GeoShape[]
 * }} GeoShape
 */
