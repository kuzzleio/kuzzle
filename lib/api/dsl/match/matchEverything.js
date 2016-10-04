/**
 * Returns the matching conditions corresponding
 * to the provided arguments
 *
 * @param {{values: Object.<string, Array>, subfilters: Array}} storage - content of all conditions to be tested
 * @param {String} fieldName - document field name
 * @return {Array}
 */
module.exports = function (storage, fieldName) {
  return [storage];
};
