var
  _ = require('lodash');

function Policies () {}


/**
 * Merge function for policies
 * @param {{value: String}} prev existing policies object
 * @param {{value: String}} cur new policies object to merge
 *
 * @return {{value: String}} the merged policies object
 */
Policies.merge = (prev, cur) => {

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

  // if neither the current policies or the new policies has "allowed" or "conditional" value,
  // the action is denied.
  cur.value = 'denied';
  return cur;
};

module.exports = Policies;