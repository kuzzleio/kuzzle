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

const { isEmpty, isNil } = require('lodash');
const Bluebird = require('bluebird');
const { v4: uuidv4 } = require('uuid');

const { KuzzleError, BadRequestError } = require('../../kerror/errors');
const { Request } = require('../request');
const { NativeController } = require('./baseController');
const formatProcessing = require('../../core/auth/formatProcessing');
const ApiKey = require('../../model/storage/apiKey');
const kerror = require('../../kerror');
const { has, get } = require('../../util/safeObject');
const { generateRandomName } = require('../../util/name-generator');
const { log } = require('winston');

/**
 * @class SecurityController
 */
class SecurityController extends NativeController {
  constructor() {
    super([
      'checkRights',
      'createApiKey',
      'createCredentials',
      'createFirstAdmin',
      'createOrReplaceProfile',
      'createOrReplaceRole',
      'createProfile',
      'createRestrictedUser',
      'createRole',
      'createUser',
      'deleteApiKey',
      'deleteCredentials',
      'deleteProfile',
      'deleteRole',
      'deleteUser',
      'getAllCredentialFields',
      'getCredentialFields',
      'getCredentials',
      'getCredentialsById',
      'getProfile',
      'getProfileMapping',
      'getProfileRights',
      'getRole',
      'getRoleMapping',
      'getUser',
      'getUserMapping',
      'getUserRights',
      'getUserStrategies',
      'hasCredentials',
      'mDeleteProfiles',
      'mDeleteRoles',
      'mDeleteUsers',
      'mGetProfiles',
      'mGetRoles',
      'mGetUsers',
      'refresh',
      'replaceUser',
      'revokeTokens',
      'scrollProfiles',
      'scrollUsers',
      'searchApiKeys',
      'searchProfiles',
      'searchRoles',
      'searchUsers',
      'searchUsersByCredentials',
      'updateCredentials',
      'updateProfile',
      'updateProfileMapping',
      'updateRole',
      'updateRoleMapping',
      'updateUser',
      'updateUserMapping',
      'validateCredentials'
    ]);

    this.subdomain = 'security';

    this.securityCollections = ['users', 'profiles', 'roles'];

    // @deprecated - helper, will be loosely coupled in the near future
    this.getStrategyMethod = global.kuzzle.pluginsManager.getStrategyMethod
      .bind(global.kuzzle.pluginsManager);
  }

  /**
   * Checks if an API action can be executed by a user
   */
  async checkRights (request) {
    const userId = request.getString('userId');
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
   * Creates a new API key for a user
   */
  async createApiKey (request) {
    const expiresIn = request.input.args.expiresIn || -1;
    const refresh = request.getRefresh('wait_for');
    const userId = request.getString('userId');
    const apiKeyId = request.getId({ ifMissing: 'ignore' });
    const description = request.getBodyString('description');

    const user = await this.ask('core:security:user:get', userId);
    const creatorId = request.getKuid();

    const apiKey = await ApiKey.create(user, expiresIn, description, {
      apiKeyId,
      bypassMaxTTL: true,
      creatorId,
      refresh,
    });

    global.kuzzle.log.info(`[SECURITY] User "${creatorId}" applied action "${request.input.action}" on user "${userId}."`);
    return apiKey.serialize({ includeToken: true });
  }

  /**
   * Search in an user API keys
   */
  async searchApiKeys (request) {
    const userId = request.getString('userId');
    let query = request.getBody({});
    const { from, size, scrollTTL } = request.getSearchParams();
    const lang = request.getLangParam();

    if (lang === 'koncorde') {
      query = await this.translateKoncorde(query);
    }

    const searchBody = {
      query: {
        bool: {
          filter: { bool: { must: { term: { userId } } } },
          must: isEmpty(query) ? { match_all: {} } : query
        }
      }
    };

    const apiKeys = await ApiKey.search(searchBody, { from, scroll: scrollTTL, size });

    return {
      hits: apiKeys.map(apiKey => apiKey.serialize()),
      total: apiKeys.length
    };
  }

  /**
   * Deletes an user API key
   */
  async deleteApiKey (request) {
    const userId = request.getString('userId');
    const apiKeyId = request.getId();
    const refresh = request.getRefresh('wait_for');

    const apiKey = await ApiKey.load(userId, apiKeyId);

    await apiKey.delete({ refresh });

    return {
      _id: apiKeyId
    };
  }


  /**
   * Get the role mapping
   *
   * @returns {Promise}
   */
  async getRoleMapping () {
    const { properties } = await global.kuzzle.internalIndex.getMapping('roles');

    return { mapping: properties };
  }

  /**
   * Update the roles collection mapping
   * @param {Request} request
   * @returns {Promise}
   */
  async updateRoleMapping (request) {
    const mappings = request.getBody();

    return global.kuzzle.internalIndex.updateMapping('roles', mappings);
  }

  /**
   * Get the profile mapping
   *
   * @returns {Promise}
   */
  async getProfileMapping () {
    const {properties} = await global.kuzzle.internalIndex.getMapping('profiles');

    return {mapping: properties};
  }

  /**
   * Update the profiles collection mapping

   * @param {Request} request
   * @returns {Promise}
   */
  updateProfileMapping (request) {
    const mappings = request.getBody();

    return global.kuzzle.internalIndex.updateMapping('profiles', mappings);
  }

  /**
   * Get the user mapping
   *
   * @returns {Promise}
   */
  async getUserMapping () {
    const {properties} = await global.kuzzle.internalIndex.getMapping('users');

    return {mapping: properties};
  }

  /**
   * Update the users collection mapping

   * @param {Request} request
   * @returns {Promise}
   */
  async updateUserMapping (request) {
    const mappings = request.getBody();

    return global.kuzzle.internalIndex.updateMapping('users', mappings);
  }

  /**
   * Get a specific role according to the given id
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async getRole(request) {
    const id = request.getId();

    const role = await this.ask('core:security:role:get', id);

    return formatProcessing.serializeRole(role);
  }

  /**
   * Get specific roles according to given ids
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async mGetRoles(request) {
    const ids = request.getBodyArray('ids');
    const roles = await this.ask('core:security:role:mGet', ids);

    return { hits: roles.map(formatProcessing.serializeRole) };
  }

  /**
   * Refresh a security collection (users, roles, profiles)
   *
   * @param {Request} request
   * @returns {Promise}
   */
  async refresh (request) {
    const collection = request.getCollection();

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
   * Search for roles
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async searchRoles (request) {
    const from = request.getInteger('from', 0);
    const size = this._getSearchPageSize(request);
    const lang = request.getLangParam();
    const body = request.getBody({});

    if (body.controllers && body.query) {
      throw BadRequestError('You cannot specifify both "controllers" and "query". Prefer the usage of "query" property with a search query.');
    }

    if (body.controllers) {
      // Type checking
      request.getBodyArray('controllers');
    }

    if (lang === 'koncorde') {
      body.query = await this.translateKoncorde(body.query || {});
    }

    const response = await this.ask(
      'core:security:role:search',
      body,
      { from, size });

    response.hits = response.hits.map(formatProcessing.serializeRole);

    return response;
  }

  /**
   * Create or replace a Role
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async createOrReplaceRole(request) {
    const id = request.getId();
    const body = request.getBody();
    const userId = request.getKuid();

    const role = await this.ask('core:security:role:createOrReplace', id, body, {
      force: request.getBoolean('force'),
      refresh: request.getRefresh('wait_for'),
      userId,
    });

    global.kuzzle.log.info(`[SECURITY] User "${userId}" applied action "${request.input.action}" on role "${role._id}."`);
    return formatProcessing.serializeRole(role);
  }

  /**
   * Create a Role
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async createRole (request) {
    const id = request.getId();
    const body = request.getBody();
    const userId = request.getKuid();

    const role = await this.ask('core:security:role:create', id, body, {
      force: request.getBoolean('force'),
      refresh: request.getRefresh('wait_for'),
      userId,
    });

    global.kuzzle.log.info(`[SECURITY] User "${userId}" applied action "${request.input.action}" on role "${role._id}."`);
    return formatProcessing.serializeRole(role);
  }

  /**
   * Remove a role according to the given id
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async deleteRole(request) {
    const id = request.getId();

    await this.ask('core:security:role:delete', id, {
      refresh: request.getRefresh('wait_for')
    });

    global.kuzzle.log.info(`[SECURITY] User "${request.getKuid()}" applied action "${request.input.action} on role "${id}."`);

    // @todo This avoids a breaking change... but we should really return
    // an acknowledgment.
    return { _id: id };
  }

  /**
   * Get a specific profile according to the given id
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async getProfile(request) {
    const id = request.getId();

    const profile = await this.ask('core:security:profile:get', id);

    return formatProcessing.serializeProfile(profile);
  }

  /**
   * Get specific profiles according to given ids
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async mGetProfiles(request) {
    const ids = request.getBodyArray('ids');

    const profiles = await this.ask('core:security:profile:mGet', ids);

    // @todo - should return an array of profiles directly, this is not a
    // search route...
    return {
      hits: profiles.map(profile => formatProcessing.serializeProfile(profile))
    };
  }

  /**
   * Create or replace a Profile
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async createOrReplaceProfile (request) {
    const id = request.getId();
    const content = request.getBody();
    const userId = request.getKuid();

    // Assert: must have a "policies" array
    request.getBodyArray('policies');

    const profile = await this.ask(
      'core:security:profile:createOrReplace',
      id,
      content,
      {
        refresh: request.getRefresh('wait_for'),
        strict: request.getBoolean('strict'),
        userId,
      });

    global.kuzzle.log.info(`[SECURITY] User "${userId}" applied action "${request.input.action}" on profile "${profile._id}."`);

    return formatProcessing.serializeProfile(profile);
  }

  /**
   * Create a Profile
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async createProfile (request) {
    const id = request.getId();
    const content = request.getBody();
    const userId = request.getKuid();

    // Assert: must have a "policies" array
    request.getBodyArray('policies');

    const profile = await this.ask(
      'core:security:profile:create',
      id,
      content,
      {
        refresh: request.getRefresh('wait_for'),
        strict: request.getBoolean('strict'),
        userId,
      });

    global.kuzzle.log.info(`[SECURITY] User "${userId}" applied action "${request.input.action}" on profile "${profile._id}."`);

    return formatProcessing.serializeProfile(profile);
  }

  /**
   * Deletes a profile
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async deleteProfile(request) {
    const id = request.getId();
    const userId = request.getKuid();
    const options = {
      onAssignedUsers: request.getString('onAssignedUsers', 'fail'),
      refresh: request.getRefresh('wait_for'),
      userId };

    await this.ask('core:security:profile:delete', id, options);

    global.kuzzle.log.info(`[SECURITY] User "${userId}" applied action "${request.input.action}" on profile "${id}."`);

    // @todo - replace by an acknowledgement
    return { _id: id };
  }

  /**
   * Search for profiles
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async searchProfiles (request) {
    const size = this._getSearchPageSize(request);
    const { from, scrollTTL, searchBody } = request.getSearchParams();
    const lang = request.getLangParam();
    const body = request.getBody({});

    if (body.roles && body.query) {
      throw BadRequestError('You cannot specifify both "roles" and "query". Prefer the usage of "query" property with a search query.');
    }

    if (body.roles) {
      const roles = request.getBodyArray('roles');

      request.addDeprecation('auto-version', 'Usage of the "roles" property is deprecated. Prefer the usage of "query" property with a search query.');

      if (roles.length > 0) {
        searchBody.query = { terms: { 'policies.roleId': roles } };
      }
      else {
        searchBody.query = { match_all: {} };
      }
      delete body.roles;
    }

    if (lang === 'koncorde') {
      searchBody.query = await this.translateKoncorde(searchBody.query || {});
    }

    const response = await this.ask('core:security:profile:search', searchBody, {
      from,
      scroll: scrollTTL,
      size,
    });

    response.hits = response.hits.map(formatProcessing.serializeProfile);

    return response;
  }

  /**
   * Given a user id, returns the matching User object
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async getUser(request) {
    const id = request.getId();
    const user = await this.ask('core:security:user:get', id);

    return formatProcessing.serializeUser(user);
  }

  /**
   * Get specific users according to given ids
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  async mGetUsers(request) {
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

    const users = await this.ask('core:security:user:mGet', ids);

    return { hits: users.map(user => formatProcessing.serializeUser(user)) };
  }

  /**
   * Given a profile id, returns the matching profile's rights as an array.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async getProfileRights(request) {
    const id = request.getId();

    const profile = await this.ask('core:security:profile:get', id);
    const rights = await profile.getRights();
    const hits = Object
      .keys(rights)
      .reduce((array, item) => array.concat(rights[item]), []);

    return {
      hits,
      total: hits.length
    };
  }

  /**
   * Given a user id, returns the matching user's rights as an array.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async getUserRights(request) {
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
   * Given a user id, returns the matching user's strategies as an array.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async getUserStrategies(request) {
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
   * Returns the User objects matching the given query
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async searchUsers(request) {
    const size = this._getSearchPageSize(request);
    const { from, scrollTTL, searchBody } = request.getSearchParams();
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
   * Given a credentials related search query, returns matched users' kuid.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async searchUsersByCredentials (request) {
    const strategy = request.getString('strategy');
    const lang = request.getLangParam();
    const { from, size, searchBody } = request.getSearchParams();

    this.assertIsStrategyRegistered(strategy);

    const searchMethod = this.getStrategyMethod(strategy, 'search');

    if (! searchMethod) {
      throw kerror.get('plugin', 'strategy', 'missing_optional_method', 'search', strategy);
    }

    if (lang === 'koncorde') {
      searchBody.query = await this.translateKoncorde(searchBody.query || {});
    }

    this.assertNotExceedMaxFetch(size - from);

    return searchMethod(searchBody, { from, size });
  }

  /**
   * Deletes a user from Kuzzle
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async deleteUser(request) {
    const id = request.getId();
    const options = { refresh: request.getRefresh('wait_for') };

    await this.ask('core:security:user:delete', id, options);

    global.kuzzle.log.info(`[SECURITY] User "${request.getKuid()}" applied action "${request.input.action}" on user "${id}."`);

    return { _id: id };
  }

  /**
   * Creates a new User object in Kuzzle's database layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async createUser(request) {
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
  async createRestrictedUser(request) {
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
   * Updates an existing User
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async updateUser(request) {
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
  async replaceUser (request) {
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
   * Updates an existing profile
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async updateProfile(request) {
    const id = request.getId();
    const body = request.getBody();
    const userId = request.getKuid();

    const updated = await this.ask('core:security:profile:update', id, body, {
      refresh: request.getRefresh('wait_for'),
      retryOnConflict: request.getInteger('retryOnConflict', 10),
      strict: request.getBoolean('strict'),
      userId,
    });

    global.kuzzle.log.info(`[SECURITY] User "${userId}" applied action "${request.input.action}" on profile "${id}."`);
    return formatProcessing.serializeProfile(updated);
  }

  /**
   * Updates an existing role
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async updateRole(request) {
    const id = request.getId();
    const body = request.getBody();
    const userId = request.getKuid();

    const updated = await this.ask('core:security:role:update', id, body, {
      force: request.getBoolean('force'),
      refresh: request.getRefresh('wait_for'),
      retryOnConflict: request.getInteger('retryOnConflict', 10),
      userId,
    });

    global.kuzzle.log.info(`[SECURITY] User "${userId}" applied action "${request.input.action}" on role "${id}."`);

    return formatProcessing.serializeRole(updated);
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
   * Deletes multiple profiles
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mDeleteProfiles(request) {
    return this._mDelete('profile', request);
  }

  /**
   * Deletes multiple roles
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mDeleteRoles(request) {
    return this._mDelete('role', request);
  }

  /**
   * Deletes multiple users
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mDeleteUsers(request) {
    return this._mDelete('user', request);
  }

  /**
   * Scroll a paginated users search result
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async scrollUsers(request) {
    const id = request.getString('scrollId');
    const ttl = request.getScrollTTLParam();

    const response = await this.ask('core:security:user:scroll', id, ttl);

    response.hits = response.hits.map(formatProcessing.serializeUser);

    return response;
  }

  /**
   * Scroll a paginated profiles search result
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async scrollProfiles(request) {
    const id = request.getString('scrollId');
    const ttl = request.getScrollTTLParam();

    const response = await this.ask('core:security:profile:scroll', id, ttl);

    response.hits = response.hits.map(formatProcessing.serializeProfile);

    return response;
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async createCredentials(request) {
    const id = request.getId();
    const body = request.getBody();
    const strategy = request.getString('strategy');

    this.assertIsStrategyRegistered(strategy);

    // Throws if the user doesn't exist
    await this.ask('core:security:user:get', id);

    const validateMethod = this.getStrategyMethod(strategy, 'validate');

    await validateMethod(request, body, id, strategy, false);

    const createMethod = this.getStrategyMethod(strategy, 'create');

    global.kuzzle.log.info(`[SECURITY] User "${request.getKuid()}" applied action "${request.input.action}" on user "${id}."`);
    return createMethod(request, body, id, strategy);
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async updateCredentials(request) {
    const id = request.getId();
    const body = request.getBody();
    const strategy = request.getString('strategy');

    this.assertIsStrategyRegistered(strategy);

    // Throws if the user doesn't exist
    await this.ask('core:security:user:get', id);

    const validateMethod = this.getStrategyMethod(strategy, 'validate');

    await validateMethod(request, body, id, strategy, true);

    const updateMethod = this.getStrategyMethod(strategy, 'update');

    global.kuzzle.log.info(`[SECURITY] User "${request.getKuid()}" applied action "${request.input.action}" on user "${id}."`);

    return updateMethod(request, body, id, strategy);
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  async hasCredentials(request) {
    const id = request.getId();
    const strategy = request.getString('strategy');

    this.assertIsStrategyRegistered(strategy);

    const existsMethod = this.getStrategyMethod(strategy, 'exists');

    return existsMethod(request, id, strategy);
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  async validateCredentials(request) {
    const strategy = request.getString('strategy');

    this.assertIsStrategyRegistered(strategy);

    const validateMethod = this.getStrategyMethod(strategy, 'validate');

    return validateMethod(
      request,
      request.getBody(),
      request.getId({ ifMissing: 'ignore' }),
      strategy,
      false);
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async deleteCredentials(request) {
    const id = request.getId();
    const strategy = request.getString('strategy');

    this.assertIsStrategyRegistered(strategy);

    const deleteMethod = this.getStrategyMethod(strategy, 'delete');

    await deleteMethod(request, id, strategy);

    global.kuzzle.log.info(`[SECURITY] User "${request.getKuid()}" applied action "${request.input.action}" on user "${id}."`);

    return {acknowledged: true};
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async getCredentials(request) {
    const id = request.getId();
    const strategy = request.getString('strategy');

    this.assertIsStrategyRegistered(strategy);

    if (global.kuzzle.pluginsManager.hasStrategyMethod(strategy, 'getInfo')) {
      const getInfoMethod = this.getStrategyMethod(strategy, 'getInfo');

      return getInfoMethod(request, id, strategy);
    }

    return {};
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async getCredentialsById(request) {
    const id = request.getId();
    const strategy = request.getString('strategy');

    this.assertIsStrategyRegistered(strategy);

    if (global.kuzzle.pluginsManager.hasStrategyMethod(strategy, 'getById')) {
      const getByIdMethod = this.getStrategyMethod(strategy, 'getById');

      return getByIdMethod(request, id, strategy);
    }

    return {};
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async getCredentialFields(request) {
    const strategy = request.getString('strategy');

    this.assertIsStrategyRegistered(strategy);

    return global.kuzzle.pluginsManager.getStrategyFields(strategy);
  }

  /**
   * @returns {Promise<Object>}
   */
  async getAllCredentialFields() {
    const strategyFields = {};

    global.kuzzle.pluginsManager.listStrategies()
      .forEach(strategy => {
        strategyFields[strategy] =
          global.kuzzle.pluginsManager.getStrategyFields(strategy);
      });

    return strategyFields;
  }

  /**
   * @param {Request} request
   * @returns {Promise.<null>}
   */
  async revokeTokens(request) {
    const id = request.getId();

    await this.ask('core:security:token:deleteByKuid', id);

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

  /**
   * @param {Request} request
   * @returns {Promise}
   * @private
   */
  async _persistUser(request, profileIds, content, { humanReadableId=true } = {}) {
    const credentials = request.getBodyObject('credentials', {});
    const strategies = Object.keys(credentials);
    const generator = humanReadableId
      ? () => generateRandomName('kuid')
      : () => 'kuid-' + uuidv4();

    let id = '';
    let alreadyExists = false;
    // Early checks before the user is created
    do {
      let generated = false;
      id = request.getId({
        generator: () => {
          generated = true;

          return generator();
        },
        ifMissing: 'generate',
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
        const validate = this.getStrategyMethod(strategy,'validate');

        await validate(request, credentials[strategy], id, strategy, false);
      }
      catch (error) {
        creationFailure = {error, validation: true};
        break;
      }

      try {
        const create = this.getStrategyMethod(strategy, 'create');

        await create(request, credentials[strategy], id, strategy);
        createdStrategies.push(strategy);
      }
      catch (error) {
        creationFailure = {error, validation: false};
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
   * Checks if a search result can exceeds the server configured limit
   * @param {Request} request
   * @param {number} limit
   * @throws
   */
  _getSearchPageSize(request) {
    const size = request.getInteger(
      'size',
      global.kuzzle.config.limits.documentsFetchCount);

    this.assertNotExceedMaxFetch(size);

    return size;
  }
}

module.exports = SecurityController;
