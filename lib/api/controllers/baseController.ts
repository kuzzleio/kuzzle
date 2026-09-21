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

import type { JSONObject } from "kuzzle-sdk";
import * as kerror from "../../kerror";
import { get, isPlainObject } from "../../util/safeObject";
import type { KuzzleRequest } from "../request";

const assertionError = kerror.wrap("api", "assert");

/** What `QueryTranslator` throws for a Koncorde keyword it cannot translate. */
function isKeywordError(
  thrown: unknown,
): thrown is { keyword: { name: string; type: string } } {
  return (
    typeof thrown === "object" &&
    thrown !== null &&
    "keyword" in thrown &&
    isPlainObject(thrown.keyword)
  );
}

/**
 * Handler of a controller action. Returns the action result, or a promise of
 * it — the funnel awaits whatever comes back.
 */
export type ControllerAction = (request: KuzzleRequest) => unknown;

/**
 * Base class for all controllers
 */
export class BaseController {
  protected __actions: Set<string>;

  constructor() {
    this.__actions = new Set();
  }

  get _actions() {
    return this.__actions;
  }

  _addAction(name: string, fn: ControllerAction) {
    this.__actions.add(name);
    // `name` is a runtime-built key, so a plain `this[name] = fn` cannot be
    // typed without opening the whole class to an index signature — the same
    // trade-off TD-28 (#2704) settled in `memoryStorageController` with
    // `Reflect.set`, kept consistent here.
    Reflect.set(this, name, fn);
  }

  /**
   * Check if the provided action name exists within that controller.
   * This check's purpose is to prevent actions leak by making actions exposure
   * explicit.
   *
   * @param name
   */
  _isAction(name: string) {
    return this.__actions.has(name);
  }
}

export class NativeController extends BaseController {
  protected ask: (event: string, ...args: any[]) => Promise<any>;
  protected pipe: (event: string, ...args: any[]) => Promise<any>;

  constructor(actions: string[] = []) {
    super();

    this.ask = global.kuzzle.ask.bind(global.kuzzle);
    this.pipe = global.kuzzle.pipe.bind(global.kuzzle);
    this.__actions = new Set(actions);
  }

  /**
   * Controller optional initialization method.
   * Used to perform asynchronous initialization safely: the funnel will wait
   * for all controllers to be initialized before accepting requests.
   */
  async init() {
    // nothing here
  }

  async translateKoncorde(koncordeFilters: JSONObject) {
    if (Object.keys(koncordeFilters).length === 0) {
      return {};
    }

    if (typeof koncordeFilters !== "object") {
      throw assertionError.get("invalid_type", "body.query", "object");
    }

    try {
      return await this.ask("core:storage:public:translate", koncordeFilters);
    } catch (error) {
      // `QueryTranslator` raises a `KeywordError`, which carries the keyword
      // it could not translate. Anything else is not this method's to
      // reinterpret — duck-typed, as it was, since that class is not
      // exported.
      const keyword = isKeywordError(error) ? error.keyword : undefined;

      if (keyword === undefined) {
        throw error;
      }

      throw assertionError.get(
        "koncorde_restricted_keyword",
        keyword.type,
        keyword.name,
      );
    }
  }

  /**
   * Throws if the body contain one of the specified attribute
   *
   * @param request
   * @param paths
   */
  assertBodyHasNotAttributes(request: KuzzleRequest, ...paths: string[]) {
    if (request.input.body !== null) {
      for (const path of paths) {
        if (get(request.input.body, path)) {
          throw assertionError.get("forbidden_argument", `body.${path}`);
        }
      }
    }
  }

  /**
   * Throws if the strategy does not exists
   *
   * @todo move this method in some kind of "Security" class
   */
  assertIsStrategyRegistered(strategy: string) {
    if (!global.kuzzle.pluginsManager.listStrategies().includes(strategy)) {
      throw kerror.get("security", "credentials", "unknown_strategy", strategy);
    }
  }

  /**
   * Throw if some target have:
   * - missing properties
   * - invalid types
   * - unauthorized values
   *
   * @param Array of targets
   * @param options.allowEmptyCollections
   */
  assertTargetsAreValid(
    targets: Array<{ index: string; collections?: string[] }>,
    { allowEmptyCollections = false } = {},
  ) {
    for (const [i, target] of targets.entries()) {
      if (!target.index) {
        throw kerror.get(
          "api",
          "assert",
          "missing_argument",
          `targets[${i}].index`,
        );
      }
      if (this._hasMultiTargets(target.index)) {
        throw kerror.get(
          "services",
          "storage",
          "invalid_target_format",
          `targets[${i}].index`,
          target.index,
        );
      }

      // Read once, and the two "nothing to check" cases answered where they
      // are decided: the chain this replaces dereferenced `target.collections`
      // twice past the guards that had established it, which is what the
      // `allowEmptyCollections` branch made unprovable.
      const collections = target.collections;

      if (collections === undefined) {
        if (!allowEmptyCollections) {
          throw kerror.get(
            "api",
            "assert",
            "missing_argument",
            `targets[${i}].collections`,
          );
        }

        continue;
      }

      if (!Array.isArray(collections)) {
        throw kerror.get(
          "api",
          "assert",
          "invalid_type",
          `targets[${i}].collections`,
          "array",
        );
      }

      if (collections.length === 0) {
        if (!allowEmptyCollections) {
          throw kerror.get(
            "api",
            "assert",
            "empty_argument",
            `targets[${i}].collections`,
          );
        }

        continue;
      }

      for (const [j, collection] of collections.entries()) {
        if (typeof collection !== "string") {
          throw kerror.get(
            "api",
            "assert",
            "invalid_type",
            `targets[${i}].collections[${j}]`,
            "string",
          );
        }

        if (this._hasMultiTargets(collection)) {
          throw kerror.get(
            "services",
            "storage",
            "invalid_target_format",
            `targets[${i}].collections[${j}]`,
            collection,
          );
        }
      }
    }
  }

  _hasMultiTargets(str: string) {
    return [",", "*", "+"].some((chr) => str.includes(chr)) || str === "_all";
  }

  /**
   * Throws if page size exceeed Kuzzle limits
   *
   * @param asked
   * @throws
   */
  assertNotExceedMaxFetch(asked: number) {
    const limit = global.kuzzle.config.limits.documentsFetchCount;

    if (asked > limit) {
      throw kerror.get("services", "storage", "get_limit_exceeded");
    }
  }

  /**
   * Throws if number of documents exceeed Kuzzle limits
   *
   * @param asked
   * @throws
   */
  assertNotExceedMaxWrite(asked: number) {
    const limit = global.kuzzle.config.limits.documentsWriteCount;

    if (asked > limit) {
      throw kerror.get("services", "storage", "write_limit_exceeded");
    }
  }
}
