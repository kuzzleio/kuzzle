var intersect = require('../util/intersect');

/**
 * Returns the matching subfilters corresponding
 * to the <f,o> pairs structure and the provided data
 *
 * @param {Object} storage - content of all conditions to be tested
 * @param {Object} document
 * @return {Array}
 */
module.exports = function (storage, document) {
  var
    documentKeys = Object.keys(document),
    result = [],
    fields = intersect(documentKeys, storage.keys.array);

  fields.forEach(f => {
    Array.prototype.push.apply(result, storage.fields[f]);
  });

  return result;
};
