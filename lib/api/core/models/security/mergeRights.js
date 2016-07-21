var
  _ = require('lodash');

/**
 * Merge function for rights
 * @param {{value: String}} prev existing rights object
 * @param {{value: String}} cur new rights object to merge
 *
 * @return {{value: String}} the merged rights object
 */
module.exports = function mergeRights (prev, cur) {
  if (cur.value === 'allowed') {
    return cur;
  }
  if (cur.value === true) {
    cur.value = 'allowed';
    return cur;
  }

  if (prev !== undefined) {
    if (prev.value === 'allowed') {
      cur.value = 'allowed';
      return cur;
    }
    if (prev.value === true) {
      cur.value = 'allowed';
      return cur;
    }
  }

  if (cur.value === 'conditional') {
    return cur;
  }
  if (_.isObject(cur.value)) {
    cur.value = 'conditional';
    return cur;
  }

  if (prev !== undefined) {
    if (prev.value === 'conditional') {
      cur.value = 'conditional';
      return cur;
    }
    if (_.isObject(prev.value)) {
      cur.value = 'conditional';
      return cur;
    }
  }

  // if neither the current rights or the new rights has "allowed" or "conditional" value,
  // the action is denied.
  cur.value = 'denied';
  return cur;
};
