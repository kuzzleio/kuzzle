/**
 * Returns the matching subfilters corresponding
 * to the <f,o> pairs structure and the provided data
 *
 * @param {Object} storage - content of all conditions to be tested
 * @param {Object} document
 * @return {Array}
 */
module.exports = function (storage, document) {
  var subfilters = [];

  Object.keys(storage).forEach(field => {
    var result;

    if (document[field]) {
      result = storage[field].values[document[field]];

      if (result) {
        Array.prototype.push.apply(subfilters, result);
      }
    }
  });

  return subfilters;
};
