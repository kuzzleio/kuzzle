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
 * `dumpme` ships no types. This is its whole API, read off `index.js` at
 * 2.0.0: a single default-exported function, both arguments optional, over a
 * native binding that shells out to `gcore`.
 *
 * Declared here rather than left implicitly `any` so that `dumpGenerator.ts`
 * does not cost the `implicit-any` ratchet a point for a two-argument call.
 */
declare module "dumpme" {
  /**
   * Dumps the current process.
   *
   * @param gcore - path and filename of the gcore binary (default: `gcore`)
   * @param coredump - path and filename of the target coredump file
   *                   (default: `${process.cwd()}/core.${process.pid}`)
   */
  function dump(gcore?: string, coredump?: string): boolean;

  export = dump;
}
