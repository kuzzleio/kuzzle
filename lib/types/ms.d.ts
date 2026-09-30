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
 * `ms` 2.1.3 ships no types. Declared here rather than depended on through
 * `@types/ms`, the same reasoning as `didyoumean.d.ts`: a dependency change is
 * not this slice's to make, and the API Kuzzle uses is one function.
 *
 * `ms` also converts the other way (`ms(60000)` → `"1m"`) and takes a `long`
 * option. Kuzzle only ever parses a duration string, so only that direction is
 * declared: an unused declaration is a claim nothing checks.
 */
declare module "ms" {
  /**
   * @param value - a duration string, e.g. `"15m"`
   *
   * @returns the duration in milliseconds, or `undefined` when `value` is not
   * a duration `ms` understands.
   */
  function ms(value: string): number | undefined;

  export = ms;
}
