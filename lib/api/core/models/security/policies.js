/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const _ = require('lodash');

/**
 * Merge function for policies
 * @param {{value: String}} prev existing policies object
 * @param {{value: String}} cur new policies object to merge
 *
 * @return {{value: String}} the merged policies object
 */
function merge(prev, cur) {
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
}

module.exports = {merge};
