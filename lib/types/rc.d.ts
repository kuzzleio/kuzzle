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
 * `rc` ships no types. Declared here rather than depended on through
 * `@types/rc`, the same reasoning as `ms.d.ts`: a dependency change is not a
 * typing slice's to make.
 *
 * `rc` also takes `argv` and a custom parser. `lib/config` calls it with a
 * name and the packaged defaults and nothing else — an unused declaration is
 * a claim nothing checks.
 */
declare module "rc" {
  /**
   * @param name - the application name, e.g. `"kuzzle"` for `.kuzzlerc`
   * @param defaults - the packaged configuration the files and the
   *                   environment are applied over
   *
   * @returns the merged configuration. Every value read from a file or from
   * the environment arrives as a string, which is what `unstringify()` in
   * `lib/config` exists for.
   */
  function rc<T>(name: string, defaults: T): T & Record<string, unknown>;

  export = rc;
}
