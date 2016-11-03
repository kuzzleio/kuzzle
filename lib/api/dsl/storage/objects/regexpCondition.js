/**
 * Stores a regular expression condition,
 * pre-compiling the regular expression in the
 * process.
 *
 * This allows V8 to convert this object to a pure
 * C++ class, with direct access to its members,
 * instead of a dictionary with b-search access time
 *
 * @param {string} pattern - regexp pattern
 * @param {string} flags - regexp flags
 * @param subfilter
 * @constructor
 */
function RegexpCondition (pattern, flags, subfilter) {
  this.regexp = new RegExp(pattern, flags);
  this.stringValue = this.regexp.toString();
  this.subfilters = [subfilter];
}

/**
 * @type {RegexpCondition}
 */
module.exports = RegexpCondition;