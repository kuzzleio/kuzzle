/**
 * Returns a boolean indicating if the provided object
 * contains only 1 property or more
 *
 * Does not check own properties on purpose.
 *
 * A little faster than Object.keys(obj).length === 1 as it
 * prevents building a whole new array just to check if it
 * has only 1 property.
 * This very little time gain adds up when handling very
 * large number of tests, like large number of subscriptions
 * being destroyed at once.
 *
 * @param {Object} obj
 * @returns {Boolean}
 */
module.exports = function containsOne(obj) {
  var count = 0;

  for (let p in obj) {
    if (++count > 1) {
      return false;
    }
  }

  return count === 1;
};
