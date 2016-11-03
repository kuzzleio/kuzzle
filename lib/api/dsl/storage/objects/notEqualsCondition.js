/**
 * @param {string} value
 * @param {Object} subfilter
 * @constructor
 */
function NotEqualsCondition (value, subfilter) {
  this.value = value;
  this.subfilters = [subfilter];
}

/**
 * @type {NotEqualsCondition}
 */
module.exports = NotEqualsCondition;
