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

const { isNil } = require('lodash');
const Bluebird = require('bluebird');
const { v4: uuidv4 } = require('uuid');

const { KuzzleError } = require('../../kerror/errors');
const kerror = require('../../kerror');
const { has, get } = require('../../util/safeObject');
const { Request } = require('../request');
const nameGenerator = require('../../util/name-generator');
const formatProcessing = require('../../core/auth/formatProcessing');
const NativeSecurityController = require('./base/nativeSecurityController');

/**
 * @class UserController
 */
class UserController extends NativeSecurityController {
  constructor() {
    super([
      'create',
      'createRestricted',
      'createFirstAdmin',
      'get',
      'mGet',
      'search',
      'scroll',
      'update',
      'replace',
      'delete',
      'mDelete',
      'mappings',
      'updateMappings',
      'rights',
      'checkRights',
      'strategies',
      'revokeTokens',
      'refresh'
    ]);

    this.subdomain = 'security';

    // @deprecated - helper, will be loosely coupled in the near future
    this.getStrategyMethod = global.kuzzle.pluginsManager.getStrategyMethod
      .bind(global.kuzzle.pluginsManager);
  }

  /**
   * @param {Request} request
   * @returns {Promise}
   * @private
   */
  async _persistUser (request, profileIds, content, { humanReadableId = true } = {}) {
    const generator = humanReadableId ? nameGenerator : uuidv4;
    const credentials = request.getBodyObject('credentials', {});
    const strategies = Object.keys(credentials);

    let id = '';
    let alreadyExists = false;
    // Early checks before the user is created
    do {
      let generated = false;
      id = request.getId({
        generator: () => {
          generated = true;
          return `kuid-${generator()}`;
        },
        ifMissing: 'generate'
      });

      for (const strategy of strategies) {
        if (!global.kuzzle.pluginsManager.listStrategies().includes(strategy)) {
          throw kerror.get(
            'security',
            'credentials',
            'unknown_strategy',
            strategy);
        }

        const exists = this.getStrategyMethod(strategy, 'exists');
        alreadyExists = await exists(request, id, strategy);
        if (alreadyExists) {
          if (generated) {
            break; // exit for loop, to regenerate an id
          }

          throw kerror.get(
            'security',
            'credentials',
            'database_inconsistency',
            id);
        }
      }

    } while (alreadyExists);

    const user = await this.ask(
      'core:security:user:create',
      id,
      profileIds,
      content,
      { refresh: request.getRefresh('wait_for') });

    const createdUser = formatProcessing.serializeUser(user);

    // Creating credentials
    let creationFailure = null;
    const createdStrategies = [];

    for (const strategy of strategies) {
      try {
        const validate = this.getStrategyMethod(strategy, 'validate');

        await validate(request, credentials[strategy], id, strategy, false);
      }
      catch (error) {
        creationFailure = { error, validation: true };
        break;
      }

      try {
        const create = this.getStrategyMethod(strategy, 'create');

        await create(request, credentials[strategy], id, strategy);
        createdStrategies.push(strategy);
      }
      catch (error) {
        creationFailure = { error, validation: false };
        break;
      }
    }

    if (creationFailure === null) {
      global.kuzzle.log.info(`[SECURITY] User "${request.getKuid()}" applied action "${request.input.action}" on user "${id}."`);
      return createdUser;
    }

    // Failed to create credentials: rollback created strategies
    const deletionErrors = [];
    for (const strategy of createdStrategies) {
      try {
        const del = this.getStrategyMethod(strategy, 'delete');
        await del(request, id, strategy);
      }
      catch (e) {
        // We catch any error produced by delete as we want to make as much
        // cleanup as possible
        deletionErrors.push(e);
      }
    }

    try {
      this.ask('core:security:user:delete', id, { refresh: 'false' });
    }
    catch (e) {
      global.kuzzle.log.error(`User rollback error: ${e}`);
    }

    if (deletionErrors.length > 0) {
      // 2 errors > we
      throw kerror.get(
        'plugin',
        'runtime',
        'unexpected_error',
        [
          creationFailure.error.message,
          ...deletionErrors.map(e => e.message)
        ].join('\n'));
    }

    if (creationFailure.error instanceof KuzzleError) {
      throw creationFailure.error;
    }

    if (creationFailure.validation) {
      throw kerror.getFrom(
        creationFailure.error,
        'security',
        'credentials',
        'rejected',
        creationFailure.error.message);
    }

    throw kerror.getFrom(
      creationFailure.error,
      'plugin',
      'runtime',
      'unexpected_error',
      creationFailure.error.message);
  }

  /**
   * Creates a new User object in Kuzzle's database layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async create (request) {
    const content = request.getBodyObject('content');
    const profileIds = get(content, 'profileIds');
    const humanReadableId = request.getString('kuid', 'human') !== 'uuid';

    if (profileIds === undefined) {
      throw kerror.get('api', 'assert', 'missing_argument', 'body.content.profileIds');
    }

    if (!Array.isArray(profileIds)) {
      throw kerror.get('api', 'assert', 'invalid_type', 'body.content.profileIds', 'array');
    }

    return this._persistUser(request, profileIds, content, { humanReadableId });
  }

  /**
   * Creates a new User object in Kuzzle's database layer and applies restricted profileIds
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async createRestricted (request) {
    const content = request.getBodyObject('content', {});
    const humanReadableId = request.getString('kuid', 'human') !== 'uuid';

    if (has(content, 'profileIds')) {
      throw kerror.get('api', 'assert', 'forbidden_argument', 'body.content.profileIds');
    }

    return this._persistUser(
      request,
      global.kuzzle.config.security.restrictedProfileIds,
      content,
      { humanReadableId });
  }

  /**
   * Creates the first admin user if it does not already exist
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async createFirstAdmin (request) {
    const adminExists = await global.kuzzle.ask('core:security:user:admin:exist');

    if (adminExists) {
      throw kerror.get('api', 'process', 'admin_exists');
    }

    const userId = request.getKuid();
    const content = request.getBodyObject('content', {});
    const reset = request.getBoolean('reset');
    const humanReadableId = request.getString('kuid', 'human') !== 'uuid';

    if (has(content, 'profileIds')) {
      throw kerror.get('api', 'assert', 'forbidden_argument', 'body.content.profileIds');
    }

    const user = await this._persistUser(request, [ 'admin' ], content, { humanReadableId });

    if (reset) {
      for (const type of ['role', 'profile']) {
        await Bluebird.map(
          Object.entries(global.kuzzle.config.security.standard[`${type}s`]),
          ([name, value]) => this.ask(
            `core:security:${type}:createOrReplace`,
            name,
            value,
            { refresh: 'wait_for', userId }));
      }
    }

    global.kuzzle.log.info(`[SECURITY] User "${userId}" applied action "${request.input.action}".`);

    return user;
  }

  /**
   * Given a user id, returns the matching User object
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async get (request) {
    return this._get('user', request);
  }

  /**
   * Get specific users according to given ids
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  async mGet (request) {
    let ids;

    if ( request.input.body
      && request.input.body.ids
      && Object.keys(request.input.body.ids).length
    ) {
      ids = request.getBodyArray('ids');
    }
    else {
      ids = request.getString('ids').split(',');
    }

    return this._mGet('user', ids);
  }

  /**
   * Returns the User objects matching the given query
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async search (request) {
    const { from, scrollTTL, searchBody, size } = request.getSearchParams({ defaultSize: -1 });
    const lang = request.getLangParam();

    if (lang === 'koncorde') {
      searchBody.query = await this.translateKoncorde(searchBody.query);
    }

    const response = await this.ask('core:security:user:search', searchBody, {
      from,
      scroll: scrollTTL,
      size,
    });

    return {
      hits: response.hits.map(formatProcessing.serializeUser),
      scrollId: response.scrollId,
      total: response.total,
    };
  }

  /**
   * Scroll a paginated users search result
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async scroll (request) {
    const id = request.getString('scrollId');
    const ttl = request.getScrollTTLParam();

    const response = await this.ask('core:security:user:scroll', id, ttl);

    response.hits = response.hits.map(formatProcessing.serializeUser);

    return response;
  }

  /**
   * Updates an existing User
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async update (request) {
    const id = request.getId();
    const content = request.getBody();
    const userId = request.getKuid();
    const profileIds = isNil(content.profileIds)
      ? null
      : request.getBodyArray('profileIds');

    const updated = await this.ask(
      'core:security:user:update',
      id,
      profileIds,
      content,
      {
        refresh: request.getRefresh('wait_for'),
        retryOnConflict: request.getInteger('retryOnConflict', 10),
        userId,
      });

    global.kuzzle.log.info(`[SECURITY] User "${userId}" applied action "${request.input.action}" on user "${id}."`);

    return formatProcessing.serializeUser(updated);
  }

  /**
   * Replaces an existing User
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async replace (request) {
    const id = request.getId();
    const content = request.getBody();
    const profileIds = request.getBodyArray('profileIds');
    const userId = request.getKuid();

    const user = await this.ask(
      'core:security:user:replace',
      id,
      profileIds,
      content,
      { refresh: request.getRefresh('wait_for'), userId });

    global.kuzzle.log.info(`[SECURITY] User "${userId}" applied action "${request.input.action}" on user "${id}."`);

    return formatProcessing.serializeUser(user);
  }

  /**
   * Deletes a user from Kuzzle
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async delete (request) {
    return this._delete('user', request);
  }

  /**
   * Delete multiple users
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async mDelete (request) {
    return this._mDelete('user', request);
  }

  /**
   * Get the user mapping
   *
   * @returns {Promise}
   */
  async mappings () {
    const { properties } = await global.kuzzle.internalIndex.getMapping('users');

    return { mapping: properties };
  }

  /**
   * Update the users collection mapping

   * @param {Request} request
   * @returns {Promise}
   */
  async updateMappings (request) {
    const mappings = request.getBody();

    return global.kuzzle.internalIndex.updateMapping('users', mappings);
  }

  /**
   * Given a user id, returns the matching user's rights as an array.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async rights (request) {
    const id = request.getId();

    const user = await this.ask('core:security:user:get', id);
    const rights = await user.getRights();
    const hits = Object
      .keys(rights)
      .reduce((array, item) => array.concat(rights[item]), []);

    return {
      hits,
      total: hits.length
    };
  }

  /**
   * Checks if an API action can be executed by a user
   */
  async checkRights (request) {
    const userId = request.getId();
    const requestPayload = request.getBody();

    if (typeof requestPayload.controller !== 'string') {
      throw kerror.get('api', 'assert', 'missing_argument', 'body.controller');
    }

    if (typeof requestPayload.action !== 'string') {
      throw kerror.get('api', 'assert', 'missing_argument', 'body.action');
    }

    const user = await global.kuzzle.ask(
      'core:security:user:get',
      userId);

    const allowed = await user.isActionAllowed(new Request(requestPayload));

    return {
      allowed
    };
  }

  /**
   * Given a user id, returns the matching user's strategies as an array.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async strategies (request) {
    const userId = request.getId();
    const checkPromises = [];

    // Throws if the user doesn't exist
    await this.ask('core:security:user:get', userId);

    if (this.anonymousId === userId) {
      checkPromises.push(Bluebird.resolve(null));
    }
    else {
      const availableStrategies = global.kuzzle.pluginsManager.listStrategies();

      for (const strategy of availableStrategies) {
        const existMethod = this.getStrategyMethod(strategy, 'exists');

        checkPromises.push(
          existMethod(request, userId, strategy)
            .then(exists => exists ? strategy : null));
      }
    }

    const strategies = await Bluebird.all(checkPromises)
      .filter(item => item !== null);

    return {
      strategies,
      total: strategies.length
    };
  }

  /**
   * Revokes every token of a given user
   *
   * @param {Request} request
   * @returns {Promise.<null>}
   */
  async revokeTokens(request) {
    const id = request.getId();

    await this.ask('core:security:token:deleteByKuid', id);

    return null;
  }

  /**
   * Refresh users collection
   *
   * @param {Request} request
   * @returns {Promise}
   */
  async refresh () {
    return this._refresh('users');
  }
}

module.exports = UserController;
