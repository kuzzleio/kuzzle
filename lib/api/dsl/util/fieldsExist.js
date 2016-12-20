'use strict';

/**
 * Verifies that ALL "fields" are contained in object "obj".
 * These fields must be of type "type", and an optional regular
 * expression can be provided to check that fields are well-formed
 *
 * @param {object} obj - object containing the fields
 * @param {Array} fields - list of fields to test
 * @param {string} type - field type (typeof result)
 * @param {RegExp} [regex] - optional regex testing that a field is well-formed
 * @returns {Boolean}
 */
function fieldsExist(obj, fields, type, regex) {
  return fields.every(value => {
    return obj[value] !== undefined && typeof obj[value] === type && (!regex || regex.test(obj[value]));
  });
}

module.exports = fieldsExist;
