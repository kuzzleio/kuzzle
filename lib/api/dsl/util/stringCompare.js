/**
 * Simple string comparison method, following the same
 * behavior than C's strcmp() function.
 *
 * This function avoids making 2 comparisons to
 * determine if a < b, a == b or a > b with the usual JS
 * way of comparing values:
 *   if (a === b) return 0;
 *   return a < b ? -1 : 1;
 *
 * @param a
 * @param b
 * @returns {*}
 */
module.exports = function stringCompare(a, b) {
  var
    i,
    min = Math.min(a.length, b.length),
    r;

  for(i = 0; i < min; i++) {
    r = a.codePointAt(i) - b.codePointAt(i);

    if (r) {
      return r;
    }
  }

  return a.length - b.length;
};
