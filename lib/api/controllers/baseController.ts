/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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

import Bluebird from 'bluebird';

import { KuzzleRequest } from '../request';
import kerror from '../../kerror';
import { get } from '../../util/safeObject';
import { JSONObject } from 'kuzzle-sdk';

const assertionError = kerror.wrap('api', 'assert');

// Base class for all controllers
export class BaseController {
  protected __actions = new Set<string>();

  get _actions () {
    return this.__actions;
  }

  _addAction (name: string, fn: (request: KuzzleRequest) => any) {
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
  _isAction (name: string): boolean {
    return this.__actions.has(name);
  }
}

export class NativeController extends BaseController {
  public ask: (event: string, ...any) => Promise<any>;
  public pipe: (event: string, ...any) => Promise<any>;

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
   *
   * @returns {Promise}
   */
  init (): Promise<void> {
    return Bluebird.resolve();
  }

  async translateKoncorde (koncordeFilters: JSONObject): Promise<JSONObject> {
    if (Object.keys(koncordeFilters).length === 0) {
      return {};
    }

    if (typeof koncordeFilters !== 'object') {
      throw assertionError.get('invalid_type', 'body.query', 'object');
    }

    try {
      global.kuzzle.koncorde.validate(koncordeFilters);
    }
    catch (error) {
      throw assertionError.getFrom(error, 'koncorde_dsl_error', error.message);
    }

    try {
      return await this.ask('core:storage:public:translate', koncordeFilters);
    }
    catch (error) {
      if (! error.keyword) {
        throw error;
      }

      throw assertionError.get(
        'koncorde_restricted_keyword',
        error.keyword.type,
        error.keyword.name);
    }
  }

  /**
   * Throws if the body contain one of the specified attribute
   *
   * @param {Request} request
   * @param  {...any} paths
   */
  assertBodyHasNotAttributes (request: KuzzleRequest, ...paths) {
    if (request.input.body !== null) {
      for (const path of paths) {
        if (get(request.input.body, path)) {
          throw assertionError.get('forbidden_argument', `body.${path}`);
        }
      }
    }
  }

  /**
   * Throws if the strategy does not exists
   *
   * @todo move this method in some kind of "Security" class
   * @param {String} strategy
   */
  assertIsStrategyRegistered (strategy: string) {
    if (! global.kuzzle.pluginsManager.listStrategies().includes(strategy)) {
      throw kerror.get('security', 'credentials', 'unknown_strategy', strategy);
    }
  }

  /**
   * Throws if page size exceeed Kuzzle limits
   *
   * @param {Number} asked
   * @throws
   */
  assertNotExceedMaxFetch (asked: number) {
    const limit = global.kuzzle.config.limits.documentsFetchCount;

    if (asked > limit) {
      throw kerror.get('services', 'storage', 'get_limit_exceeded');
    }
  }

  /**
   * Throws if number of documents exceeed Kuzzle limits
   *
   * @param {Number} asked
   * @throws
   */
  assertNotExceedMaxWrite (asked: number) {
    const limit = global.kuzzle.config.limits.documentsWriteCount;

    if (asked > limit) {
      throw kerror.get('services', 'storage', 'write_limit_exceeded');
    }
  }
}
