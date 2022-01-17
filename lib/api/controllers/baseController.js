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
    this.__actions = new Set(actions);
  }

  /**
   * Controller optional initialization method.
   * Used to perform asynchronous initialization safely: the funnel will wait
   * for all controllers to be initialized before accepting requests.
   *
   * @returns {Promise}
   */
  init () {
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
   * Throw if some target have:
   * - missing properties
   * - invalid types
   * - unauthorized values
   * 
   * @param {Array<{index:string, collections?: string[]}>} targets Array of targets
   * @param {*} options
   */
  assertAreTargetsValid(targets, { emptyCollectionsAllowed } = {}) {
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];

      if (!target.index) {
        throw kerror.get('api', 'assert', 'missing_argument', `targets[${i}].index`);
      }
      if (this._hasMultiTargets(target.index)) {
        throw kerror.get('services', 'storage', 'invalid_target_format', `targets[${i}].index`, target.index);
      }

      if (!emptyCollectionsAllowed && !target.collections) {
        throw kerror.get('api', 'assert', 'missing_argument', `targets[${i}].collections`);
      }

      if (target.collections && !Array.isArray(target.collections)) {
        throw kerror.get('api', 'assert', 'invalid_type', `targets[${i}].collections`, 'array');
      }

      if (!emptyCollectionsAllowed && target.collections.length === 0) {
        throw kerror.get('api', 'assert', 'empty_argument', `targets[${i}].collections`);
      }

      if (emptyCollectionsAllowed && !target.collections || target.collections.length === 0) {
        continue;
      }

      for (let j = 0; j < target.collections.length; j++) {
        const collection = target.collections[j];

        if (typeof collection !== 'string') {
          throw kerror.get('api', 'assert', 'invalid_type', `targets[${i}].collections[${j}]`, 'string');
        }

        if (this._hasMultiTargets(collection)) {
          throw kerror.get('services', 'storage', 'invalid_target_format', `targets[${i}].collections[${j}]`, collection);
        }
      }
    }
  }

  _hasMultiTargets (str) {
    return [',', '*', '+'].some(chr => str.includes(chr)) || str === '_all';
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
