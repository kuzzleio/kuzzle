/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
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

/**
 * Binary Search
 * 
 * @param array Sorted Array
 * @param predicate A function that return -1, 0, or 1
 * - [-1] The value is greater than what you search
 * - [1] The value is lesser than what you search
 * - [0] Both value are equals
 * @returns {number} The index of the value, or -1 if not found
 */
export function binarySearch (array: any[], predicate: (value: any) => number) {
  let lowerBound = 0;
  let upperBound = array.length - 1;

  if (array.length === 1) {
    return predicate(array[0]) === 0 ? 0 : -1;
  }

  while (lowerBound <= upperBound) {
    // 5x faster than Math.floor((lowerBound + upperBound) / 2)
    const index = (lowerBound + upperBound) >> 1;
    const comparison = predicate(array[index]);
    if (comparison < 0) {
      upperBound = index - 1;
    }
    else if (comparison > 0) {
      lowerBound = index + 1;
    }
    else {
      return index;
    }
  }
  return -1;
} 