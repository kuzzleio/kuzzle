'use strict';

/**
 * Returns a boolean indicating if the provided object
 * contains exactly 1 own property
 *
 * A little faster than Object.keys(obj).length === 1 as it
 * prevents building a whole new array just to check if it
 * has only 1 property.
 * This very (very, very, very) little time gain adds up quickly
 * when handling very large number of tests, like large number
 * of subscriptions being destroyed at once
 * (8~10s gained when destroying 10k subscriptions)
 *
 * @param {object} obj
 * @returns {Boolean}
 */
module.exports = function containsOne(obj) {
  var count = 0;

  for (let p in obj) {
    if (obj.hasOwnProperty(p) && ++count > 1) {
      return false;
    }
  }

  return count === 1;
};
