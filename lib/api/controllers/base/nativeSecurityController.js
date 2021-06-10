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

const kerror = require('../../../kerror');
const NativeController = require('./nativeController');
const formatProcessing = require('../../../core/auth/formatProcessing');
const { Inflector } = require('../../../util/inflector');

/**
 * @class NativeSecurityController providing generic functions.
 * Currently used by SecurityController and UserController
 */
class NativeSecurityController extends NativeController {
  constructor (actions = []) {
    super(actions);

    this.securityCollections = ['users', 'profiles', 'roles'];
  }

  /**
   * Get a specific profile/role/user according to the given id
   *
   * @param {string.<profile|role|user>} type
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async _get (type, request) {
    const id = request.getId();

    const result = await this.ask(`core:security:${type}:get`, id);

    return formatProcessing[`serialize${Inflector.upFirst(type)}`](result);
  }

  /**
   * Get specific profiles/roles/users according to given ids
   *
   * @param {string.<profile|role|user>} type
   * @param {Array<string>} ids Array of ids
   * @returns {Promise<Object>}
   */
  async _mGet (type, ids) {
    const results = await this.ask(`core:security:${type}:mGet`, ids);

    // @todo next major
    // Return an array directly, this is not a search route...
    return {
      hits: results.map(hit =>
        formatProcessing[`serialize${Inflector.upFirst(type)}`](hit))
    };
  }

  /**
   * Remove a profile/role/user according to the given id
   *
   * @param {string.<profile|role|user>} type
   * @param {Request} request
   * @param {Object} options Optional: Additional options, 'refresh' already being considered
   * @returns {Promise<Object>}
   */
  async _delete (type, request, options = {}) {
    const id = request.getId();
    const kuid = request.getKuid();
    const action = request.input.action;

    await this.ask(`core:security:${type}:delete`, id, {
      refresh: request.getRefresh('wait_for'),
      ...options
    });

    global.kuzzle.log.info(`[SECURITY] User "${kuid}" applied action "${action}" on ${type} "${id}".`);

    // @todo next major
    // Return an acknowledgment
    return { _id: id };
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
}

module.exports = NativeSecurityController;