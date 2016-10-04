/**
 * @typedef {{
 *   validate: Function,
 *   validateFieldSpecification: Function,
 *   typeName: string,
 *   allowChildren: boolean,
 *   checkAllowedProperties: Function,
 *   getStrictness: Function
 * }} EmailType
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
 *   type_options: {
 *     range: {
 *       min: number,
 *       max: number
 *     },
 *     length: {
 *       min: number,
 *       max: number
 *     },
 *     not_empty: boolean,
 *     strict: boolean,
 *     values: string[]
 *   }
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
 *   type_options: {
 *     range: {
 *       min: number,
 *       max: number
 *     },
 *     length: {
 *       min: number,
 *       max: number
 *     },
 *     not_empty: boolean,
 *     strict: boolean,
 *     values: string[]
 *   },
 *   children: ...StructuredFieldSpecification
 * }} StructuredFieldSpecification
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