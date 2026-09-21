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
 * `sorted-array` 2.0.x ships no types. Declared here rather than depended on
 * through a `@types` package, the same reasoning as `didyoumean.d.ts`.
 *
 * Kuzzle builds one with a comparator and uses three members of it; the
 * package also exposes `remove`, `indexOf` and a static `comparing`, and none
 * of them is declared, because an unused declaration is a claim nothing checks.
 */
declare module "sorted-array" {
  class SortedArray<T> {
    /**
     * The sorted elements, in order. `tokenManager` reads and splices it
     * directly, which is why it is exposed rather than wrapped.
     */
    array: T[];

    /**
     * @param array - the initial elements
     * @param compare - orders two elements, like `Array#sort`'s comparator
     */
    constructor(array: T[], compare: (a: T, b: T) => number);

    /**
     * @returns the index of the matching element, or -1
     */
    search(item: unknown): number;

    insert(item: T): void;
  }

  export = SortedArray;
}
