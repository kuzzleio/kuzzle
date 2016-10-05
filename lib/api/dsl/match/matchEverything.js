/**
 * Returns the matching conditions corresponding
 * to the provided arguments
 *
 * @param {Object} storage - content of all conditions to be tested
 * @return {Array}
 */
module.exports = function (storage) {
  return [storage.subfilter];
};
