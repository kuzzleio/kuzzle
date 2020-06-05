/**
 * Convert a string to kebab-case
 * https://gist.github.com/thevangelist/8ff91bac947018c9f3bfaad6487fa149#gistcomment-2659294
 *
 * @param {string} string - String to convert to kebab-case
 *
 * @returns kebab-case-string
 */
function kebabCase (string) {
  return string
     // get all lowercase letters that are near to uppercase ones
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    // replace all spaces and low dash
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

module.exports = {
  kebabCase
};
