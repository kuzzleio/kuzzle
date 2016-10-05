var
  _ = require('lodash');

/**
 * Returns the matching conditions corresponding
 * to the provided arguments
 *
 * @param {{subfilters: Array<Object>}} storage - content of all conditions to be tested
 * @param {String} fieldName - document field name
 * @param {Object} document
 * @return {Array}
 */
module.exports = function (storage, fieldName, document) {
  var value = _.get(document, fieldName);

  if (value) {
    return storage.subfilters;
  }

  return [];
};
