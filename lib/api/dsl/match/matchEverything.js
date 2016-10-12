/**
 * Returns the matching conditions corresponding
 * to the provided arguments
 *
 * @param {Object} storage - content of all conditions to be tested
 * @param {Object} testTables - test tables to update when a filter matches the document
 */
module.exports = function (storage, testTables) {
  testTables.matched.push(storage.filter);
};
