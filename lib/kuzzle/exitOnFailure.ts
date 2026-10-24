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

import { inspect } from "node:util";

import type { Kuzzle } from "./kuzzle";

/**
 * Ends the process with exit code 1, for a start script whose Kuzzle failed
 * to start or to run.
 *
 * A bare `process.exit(1)` cuts Kuzzle's graceful shutdown short: the locks
 * the node holds and its ID card stay in Redis until they expire (#3022).
 * Once a Kuzzle instance exists, this goes through `shutdown(1)` instead,
 * which joins the one a failed start already began (#3020). Before that,
 * there is nothing to release.
 *
 * Internal to Kuzzle: not exported by the package.
 */
export async function exitOnFailure(): Promise<void> {
  const kuzzle = currentKuzzle();

  if (kuzzle) {
    try {
      // Ends with `process.exit`
      await kuzzle.shutdown(1);
      return;
    } catch (error) {
      kuzzle.log.error(
        `Unable to shut down: ${
          error instanceof Error ? error.message : inspect(error)
        }`,
      );
    }
  }

  process.exit(1);
}

function currentKuzzle(): Kuzzle | undefined {
  try {
    return global.kuzzle;
  } catch {
    // The `global.kuzzle` getter throws until an instance is built
    return undefined;
  }
}
