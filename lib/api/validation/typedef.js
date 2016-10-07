/**
 * @typedef {{
 *   validate: Function,
 *   validateFieldSpecification: Function,
 *   typeName: string,
 *   allowChildren: boolean,
 *   checkAllowedProperties: Function,
 *   getStrictness: Function
 * }} IpAddressType
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