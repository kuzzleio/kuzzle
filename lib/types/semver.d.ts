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
 * `semver` 7.7.3 ships no types. Declared here rather than depended on through
 * `@types/semver`, the same reasoning as `didyoumean.d.ts`.
 *
 * Kuzzle calls exactly two of its functions; the rest of a large API is left
 * undeclared on purpose, since an unused declaration is a claim nothing checks.
 */
declare module "semver" {
  /**
   * A parsed version. Only the fields Kuzzle reads back are declared.
   */
  class SemVer {
    readonly version: string;
    readonly major: number;
    readonly minor: number;
    readonly patch: number;

    toString(): string;
  }

  /**
   * Only the option Kuzzle passes is declared.
   */
  type RangeOptions = {
    includePrerelease?: boolean;
  };

  /**
   * @returns whether `version` satisfies `range`
   */
  function satisfies(
    version: string | SemVer,
    range: string,
    options?: RangeOptions,
  ): boolean;

  /**
   * Coerces a loose version string into a semver.
   *
   * @returns the parsed version, or `null` when nothing semver-shaped was found
   */
  function coerce(version: string | SemVer | null | undefined): SemVer | null;
}
