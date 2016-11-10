'use strict';

/**
 * Simple string comparison method, following the same
 * behavior than C's strcmp() function.
 * Returns 0 if "a" and "b" are equal, a negative value
 * if a < b, and a positive one if a > b
 *
 * This function avoids making 2 comparisons to
 * determine if a < b, a == b or a > b with the usual JS
 * way of comparing values:
 *   if (a === b) return 0;
 *   return a < b ? -1 : 1;
 *
 * This is usually a premature optimization as the gain
 * is very small. But given the very large number of string
 * comparisons performed, in this very specific case, the
 * performance gain is sizeable.
 *
 * @param {string} a
 * @param {string} b
 * @returns {Number}
 */
module.exports = function stringCompare(a, b) {
  let
    min = Math.min(a.length, b.length),
    r;

  for(let i = 0; i < min; i++) {
    r = a.codePointAt(i) - b.codePointAt(i);

    if (r) {
      return r;
    }
  }

  return a.length - b.length;
};
