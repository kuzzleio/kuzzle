/**
 * Updates the matched filters according to the provided data
 *
 * @param {Object} storage - content of all conditions to be tested
 * @param {Object} testTables - test tables to update when a filter matches the document
 */
module.exports = function (storage, testTables) {
  testTables.matched.push(storage.filter);
};
