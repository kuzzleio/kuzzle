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

'use strict';

const Bluebird = require('bluebird');

const kerror = require('../../kerror');
const { get } = require('../../util/safeObject');

const assertionError = kerror.wrap('api', 'assert');

// Base class for all controllers
class BaseController {
  constructor() {
    this.__actions = new Set();
  }

  get _actions() {
    return this.__actions;
  }

  _addAction (name, fn) {
    this.__actions.add(name);
    this[name] = fn;
  }

  /**
   * Check if the provided action name exists within that controller.
   * This check's purpose is to prevent actions leak by making actions exposure
   * explicit.
   *
   * @param  {string} name
   * @returns {boolean}
   */
  _isAction (name) {
    return this.__actions.has(name);
  }
}

class NativeController extends BaseController {
  constructor(actions = []) {
    super();

    this.ask = global.kuzzle.ask.bind(global.kuzzle);
    this.pipe = global.kuzzle.pipe.bind(global.kuzzle);
    this._info = {
      elasticsearch: {},
      redis: {}
    };
    this.__actions = new Set(actions);
  }

  /**
   * Controller optional initialization method.
   * Used to perform asynchronous initialization safely: the funnel will wait
   * for all controllers to be initialized before accepting requests.
   *
   * @returns {Promise}
   */
  async init () {
    const [storageInfo, cacheInfo] = await Promise.all([
      global.kuzzle.ask('core:storage:public:info:get'),
      global.kuzzle.ask('core:cache:public:info:get'),
    ]);
    this._info.elasticsearch = storageInfo;
    this._info.redis = cacheInfo;
    return Bluebird.resolve();
  }

  async translateKoncorde (koncordeFilters) {
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
  assertBodyHasNotAttributes (request, ...paths) {
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
  assertIsStrategyRegistered (strategy) {
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
  assertNotExceedMaxFetch (asked) {
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
  assertNotExceedMaxWrite (asked) {
    const limit = global.kuzzle.config.limits.documentsWriteCount;

    if (asked > limit) {
      throw kerror.get('services', 'storage', 'write_limit_exceeded');
    }
  }
}

module.exports = { BaseController, NativeController };
