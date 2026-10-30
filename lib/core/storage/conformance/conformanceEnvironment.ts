/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2026 Kuzzle
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

// The conformance kit runs a driver outside of Kuzzle. A driver may use what
// the built-in Elasticsearch drivers use of the running Kuzzle instance
// (`global.kuzzle`): its logger, its configuration, `hash`, `emit`, the
// internal cache through `ask("core:cache:internal:get" | "store" | "del")`,
// and `withLock`, whose locks live in that cache. This stands in for them
// while the kit runs, in one process.

import { createHash } from "node:crypto";

import defaultConfig from "../../../config/default.config";

/** A logger that writes nothing */
function silentLogger(): Record<string, unknown> {
  const noop = () => undefined;
  const logger: Record<string, unknown> = {
    debug: noop,
    error: noop,
    info: noop,
    trace: noop,
    warn: noop,
  };

  logger.child = () => logger;

  return logger;
}

/**
 * The commands `withLock` (redis-semaphore) sends to the cache, run in
 * memory: `SET NX PX` to acquire, and the scripts that release (key,
 * identifier) or extend (key, identifier, ttl) a lock its holder still owns.
 */
function lockClient(cache: Map<string, unknown>) {
  const runScript = (
    _script: string,
    _keys: number,
    key: string,
    identifier: string,
    ttl?: string,
  ) => {
    if (cache.get(key) !== identifier) {
      return 0;
    }

    if (ttl === undefined) {
      cache.delete(key);
    }

    return 1;
  };

  return {
    eval: runScript,
    evalsha: runScript,
    set: (key: string, value: string) => {
      if (cache.has(key)) {
        return null;
      }

      cache.set(key, value);
      return "OK";
    },
  };
}

function conformanceKuzzle() {
  const cache = new Map<string, unknown>();
  const answers: Record<string, (...args: unknown[]) => unknown> = {
    "core:cache:internal:client:get": () => lockClient(cache),
    "core:cache:internal:del": (key) => cache.delete(String(key)),
    "core:cache:internal:get": (key) => cache.get(String(key)) ?? null,
    "core:cache:internal:store": (key, value) => {
      cache.set(String(key), value);
      return true;
    },
  };

  return {
    ask: (event: string, ...args: unknown[]) => {
      const answer = answers[event];

      if (!answer) {
        return Promise.reject(
          new Error(
            `The storage driver conformance kit does not answer "${event}"`,
          ),
        );
      }

      return Promise.resolve(answer(...args));
    },
    config: defaultConfig,
    emit: () => undefined,
    hash: (input: unknown) =>
      createHash("sha256")
        .update(typeof input === "string" ? input : JSON.stringify(input))
        .digest("hex"),
    log: silentLogger(),
  };
}

/** `global.kuzzle` is a getter that throws until Kuzzle is built */
function isKuzzleRunning(): boolean {
  try {
    return Boolean(globalThis.kuzzle);
  } catch {
    return false;
  }
}

/**
 * Sets `global.kuzzle` to the stand-in, unless a Kuzzle instance (or a test
 * double of one) is already there.
 *
 * @returns Puts `global.kuzzle` back as it was
 */
export function installConformanceEnvironment(): () => void {
  if (isKuzzleRunning()) {
    return () => undefined;
  }

  const previous = Object.getOwnPropertyDescriptor(globalThis, "kuzzle");

  Object.defineProperty(globalThis, "kuzzle", {
    configurable: true,
    value: conformanceKuzzle(),
    writable: true,
  });

  return () => {
    if (previous) {
      Object.defineProperty(globalThis, "kuzzle", previous);
    } else {
      Reflect.deleteProperty(globalThis, "kuzzle");
    }
  };
}
