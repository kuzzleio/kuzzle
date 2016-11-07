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
 * @param subfilter
 * @param {string} [flags] - regexp flags
 * @constructor
 */
function RegexpCondition (pattern, subfilter, flags) {
  this.regexp = flags ? new RegExp(pattern, flags) : new RegExp(pattern);
  this.stringValue = this.regexp.toString();
  this.subfilters = [subfilter];
}

/**
 * @type {RegexpCondition}
 */
module.exports = RegexpCondition;