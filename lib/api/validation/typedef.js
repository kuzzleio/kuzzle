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
 *   default_value: *,
 *   multivalued: {
 *     value: boolean,
 *     minCount: number,
 *     maxCount: number
 *   },
 *   type_options: TypeOptions
 * }} FieldSpecification
 */

/**
 * @typedef {{
 *   mandatory: boolean,
 *   type: string,
 *   path: string[],
 *   depth: number,
 *   default_value: *,
 *   multivalued: {
 *     value: boolean,
 *     minCount: number,
 *     maxCount: number
 *   },
 *   type_options: TypeOptions,
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
 *   not_empty: boolean,
 *   strict: boolean,
 *   values: string[],
 *   format: string[]
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