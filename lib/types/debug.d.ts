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
 * `debug` ships no types, and `@types/debug` would be a dependency change on a
 * branch whose whole point is that it changes none. This is the surface
 * `lib/util/debug.ts` actually uses — the factory, the three module-level
 * hooks it overrides, and the `log` sink it replaces — read off debug@4's
 * `src/common.js` and `src/node.js`.
 *
 * Deliberately not the whole API: `extend`, `destroy`, `color` and the
 * namespace registry are declared nowhere below because nothing in `lib/`
 * touches them. Add one when a caller needs it, not before.
 */
declare module "debug" {
  import type { InspectOptions } from "node:util";

  export interface Debugger {
    (formatter: string, ...args: unknown[]): void;

    /**
     * Where a formatted line is written: the format string, then the values
     * its placeholders consume. `lib/util/debug.ts` replaces it so that debug
     * output goes through Kuzzle's own logger.
     */
    log: (msg: string, ...args: unknown[]) => void;

    /** False when this namespace is not enabled by `DEBUG`. */
    enabled: boolean;

    namespace: string;
  }

  export interface Debug {
    (namespace: string): Debugger;

    /**
     * Custom `%<letter>` formatters. `this` is the Debugger the line is being
     * formatted for, which is why these are not plain functions.
     */
    formatters: Record<string, (this: Debugger, value: unknown) => string>;

    /**
     * Options handed to `util.inspect` by the built-in formatters. `expand` is
     * debug's own addition, not one of node's.
     */
    inspectOpts: InspectOptions & { expand?: boolean };

    /**
     * Decorates the arguments with namespace, colour and timing before they
     * reach `log`. Kuzzle overrides it with a no-op: the logger adds its own.
     */
    formatArgs: (this: Debugger, args: unknown[]) => void;

    /** Enables the namespaces matching `namespaces`, as `DEBUG` would. */
    enable: (namespaces: string) => void;

    /** Disables every namespace, and returns the ones that were enabled. */
    disable: () => string;
  }

  const debug: Debug;

  export default debug;
}
