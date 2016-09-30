/**
 * @typedef {{
 *   validate: Function,
 *   validateFieldSpecification: Function,
 *   typeName: string
 * }} ValidationType
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