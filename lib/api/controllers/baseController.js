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
const { Request } = require('../request');

const assertionError = kerror.wrap('api', 'assert');

/**
 * @class BaseController Base class for all controllers
 */
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

/**
 * @class NativeController providing native functions for all controllers
 */
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

    try {
      await global.kuzzle.koncorde.validate(koncordeFilters);
    }
    catch (error) {
      if (error.message.includes('Unknown DSL keyword: ')) {
        const [, keyword] = error.message.split('Unknown DSL keyword: ');

        throw kerror.getFrom(error, 'api', 'assert', 'koncorde_unknown_keyword', keyword);
      }

      throw kerror.getFrom(error, 'api', 'assert', 'koncorde_dsl_error', error.message);
    }

    if (typeof koncordeFilters !== 'object') {
      throw kerror.get(
        'api',
        'assert',
        'invalid_type',
        'body.query',
        'object');
    }

    try {
      return await this.ask('core:storage:public:translate', koncordeFilters);
    }
    catch (error) {
      if (! error.keyword) {
        throw error;
      }

      throw kerror.get(
        'api',
        'assert',
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
   * @param {String} index
   * @param {String} collection
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

/**
 * @class NativeSecurityController providing native functions for SecurityController and UserController
 */
class NativeSecurityController extends NativeController {
  constructor () {
    super();

    this.securityCollections = ['users', 'profiles', 'roles'];
  }

  /**
   * Refresh a security collection (users, roles, profiles)
   *
   * @param {string} collection
   * @returns {Promise}
   */
  async _refresh (collection) {
    if (!this.securityCollections.includes(collection)) {
      throw kerror.get(
        'api',
        'assert',
        'unexpected_argument',
        collection,
        this.securityCollections);
    }

    await global.kuzzle.internalIndex.refreshCollection(collection);

    return null;
  }

  /**
   * @param {string.<profile|role|user>} type
   * @param {Request} request
   * @returns {Promise.<Array.<string>>}
   * @private
   */
  async _mDelete (type, request) {
    const ids = request.getBodyArray('ids');
    const refresh = request.getRefresh('wait_for');

    if (ids.length > global.kuzzle.config.limits.documentsWriteCount) {
      throw kerror.get('services', 'storage', 'write_limit_exceeded');
    }

    const successes = [];
    const errors = [];

    await Bluebird.map(
      ids,
      id => this.ask(`core:security:${type}:delete`, id, {refresh})
        .then(() => successes.push(id))
        .catch(err => errors.push(err)));

    if (errors.length) {
      request.setError(
        kerror.get('services', 'storage', 'incomplete_delete', errors));
    }

    if (successes.length > 1000) {
      global.kuzzle.log.info(`[SECURITY] User "${request.getKuid()}" deleted the following ${type}s: ${successes.slice(0, 1000).join(', ')}... (${successes.length - 1000} more users deleted)."`);
    }
    else {
      global.kuzzle.log.info(`[SECURITY] User "${request.getKuid()}" deleted the following ${type}s: ${successes.join(', ')}."`);
    }

    return successes;
  }
}

module.exports = { BaseController, NativeController, NativeSecurityController };
