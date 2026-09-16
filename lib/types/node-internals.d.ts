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

declare global {
  namespace NodeJS {
    interface Process {
      /**
       * Every native and JavaScript module Node has loaded, in load order.
       *
       * Real since v0.x and still present on v24, but undocumented, so
       * `@types/node` does not declare it. `dumpGenerator` has always written
       * it into `nodejs.json`; this is what lets it keep doing so without a
       * cast. Optional because nothing guarantees a future runtime keeps it.
       */
      moduleLoadList?: string[];
    }
  }
}

export {};
