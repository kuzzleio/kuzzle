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

import { JSONObject } from "kuzzle-sdk";
import * as kerror from "../../kerror";
import { get } from "../../util/safeObject";
import { KuzzleRequest } from "../request";

const assertionError = kerror.wrap("api", "assert");

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

  _addAction(name, fn) {
    this.__actions.add(name);
    this[name] = fn;
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

  constructor(actions = []) {
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
      if (!error.keyword) {
        throw error;
      }

      throw assertionError.get(
        "koncorde_restricted_keyword",
        error.keyword.type,
        error.keyword.name,
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
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];

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

      if (!allowEmptyCollections && !target.collections) {
        throw kerror.get(
          "api",
          "assert",
          "missing_argument",
          `targets[${i}].collections`,
        );
      }

      if (target.collections && !Array.isArray(target.collections)) {
        throw kerror.get(
          "api",
          "assert",
          "invalid_type",
          `targets[${i}].collections`,
          "array",
        );
      }

      if (!allowEmptyCollections && target.collections.length === 0) {
        throw kerror.get(
          "api",
          "assert",
          "empty_argument",
          `targets[${i}].collections`,
        );
      }

      if (
        allowEmptyCollections &&
        (!target.collections || target.collections.length === 0)
      ) {
        continue;
      }

      for (let j = 0; j < target.collections.length; j++) {
        const collection = target.collections[j];

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
