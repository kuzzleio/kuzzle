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
 * Exits on `SIGINT` / `SIGTERM` while Kuzzle loads, until `Kuzzle.start()`
 * replaces these handlers with its graceful ones (#3087).
 *
 * Node.js ends a process on these signals when nothing listens to them, but
 * the kernel drops a signal that has no handler when it is sent to PID 1:
 * `node` run as a container's main process, without an init, ignored a
 * `SIGTERM` received while it loaded its modules, and `docker stop` waited
 * for its grace period before killing it.
 *
 * Armed when the `kuzzle` package is imported, the earliest point there is.
 * A process that imports it without starting Kuzzle keeps Node.js' own
 * behaviour: the handler steps aside when anything else listens to the
 * signal, and otherwise ends the process as Node.js would have, with the
 * usual `128 + signal number` exit code.
 *
 * Signal handling, called before the funnel exists: synchronous on purpose.
 * Internal to Kuzzle: not exported by the package.
 */

const EXIT_CODES = { SIGINT: 130, SIGTERM: 143 } as const;

type EarlySignal = keyof typeof EXIT_CODES;
type EarlyHandlers = Record<EarlySignal, () => void>;

const SIGNALS: readonly EarlySignal[] = ["SIGINT", "SIGTERM"];

declare global {
  /**
   * Process-wide, so that two copies of this module (e.g. two installs of
   * the package) never register the handlers twice
   */
  // eslint-disable-next-line vars-on-top -- a global declaration must be a var
  var kuzzleEarlySignalHandlers: EarlyHandlers | undefined;
}

function onEarlySignal(signal: EarlySignal): void {
  // Someone else listens to it (the application, a test runner): theirs to
  // handle, as it would have been without this handler
  if (process.listenerCount(signal) > 1) {
    return;
  }

  process.stderr.write(
    `Caught signal ${signal} before Kuzzle started: exiting now\n`,
  );
  process.exit(EXIT_CODES[signal]);
}

export function armEarlySignalHandlers(): void {
  if (globalThis.kuzzleEarlySignalHandlers) {
    return;
  }

  const handlers: EarlyHandlers = {
    SIGINT: () => onEarlySignal("SIGINT"),
    SIGTERM: () => onEarlySignal("SIGTERM"),
  };

  globalThis.kuzzleEarlySignalHandlers = handlers;

  for (const signal of SIGNALS) {
    process.on(signal, handlers[signal]);
  }
}

/**
 * Removes the handlers, once `Kuzzle.start()` installs the graceful ones
 */
export function disarmEarlySignalHandlers(): void {
  const handlers = globalThis.kuzzleEarlySignalHandlers;

  if (!handlers) {
    return;
  }

  for (const signal of SIGNALS) {
    process.removeListener(signal, handlers[signal]);
  }

  globalThis.kuzzleEarlySignalHandlers = undefined;
}

armEarlySignalHandlers();
