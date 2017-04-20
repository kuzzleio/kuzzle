/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2017 Kuzzle
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
  let count = 0;

  for (const p in obj) {
    if (obj.hasOwnProperty(p)) {
      if (count > 0) {
        return false;
      }

      count++;
    }
  }

  return count === 1;
};
