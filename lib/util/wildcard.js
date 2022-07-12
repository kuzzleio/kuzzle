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

"use strict";

const _ = require("lodash");

function match(pattern, list) {
  // Match everything
  if (pattern === "*") {
    return list;
  }
  /**
   * Reduces repeating "*" to one ".*"
   * One of the fastest and most readable way to do this
   */
  const wildCardPattern = pattern
    .split("*")
    .filter(
      (patternPart, index, array) =>
        patternPart !== "" || index === 0 || index === array.length - 1
    )
    .map((patternPart) => _.escapeRegExp(patternPart)) // escape special regex characters
    .join(".*");

  // Match everything
  if (wildCardPattern === ".*") {
    return list;
  }

  const regex = new RegExp(`^${wildCardPattern}$`);

  // Keep only matching elements
  return list.filter((item) => !regex.test(item));
}

module.exports = { match };
