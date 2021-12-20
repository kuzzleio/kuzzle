const _ = require('lodash');

function match(pattern, list) {
  // Match everything
  if (pattern === '*') {
    return list;
  }
  /**
   * Reduces repeating "*" to one ".*"
   * One of the fastest and most readable way to do this
   */
  const wildCardPattern = pattern.split('*')
    .filter((patternPart, index, list) => 
      patternPart !== ''
      || index === 0
      || index === list.length - 1
    )
    .map(patternPart => _.escapeRegExp(patternPart)) // escape special regex characters
    .join('.*');
  
  // Match everything
  if (wildCardPattern === '.*') {
    return list;
  }
  
  const regex = new RegExp(`^${wildCardPattern}$`);

  // Keep only matching elements
  return list.filter(item => !regex.test(item));
}

module.exports = { match };