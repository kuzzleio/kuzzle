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
const { KuzzleError, Request } = require('kuzzle-common-objects');

const { NativeController, ifMissingEnum } = require('./base');
const formatProcessing = require('../../core/auth/formatProcessing');
const ApiKey = require('../../model/storage/apiKey');
const kerror = require('../../kerror');
const { has, get } = require('../../util/safeObject');

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 * @property {Kuzzle} kuzzle
 */
class SecurityController extends NativeController {
  constructor(kuzzle) {
    super(kuzzle, [
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
    this.getStrategyMethod = this.kuzzle.pluginsManager.getStrategyMethod
      .bind(this.kuzzle.pluginsManager);
  }

  /**
   * Checks if an API action can be executed by a user
   */
  async checkRights (request) {
    const userId = this.getString(request, 'userId');
    const requestPayload = this.getBodyObject(request, 'request');

    if (typeof requestPayload.controller !== 'string') {
      throw kerror.get('api', 'assert', 'missing_argument', 'body.controller');
    }

    if (typeof requestPayload.action !== 'string') {
      throw kerror.get('api', 'assert', 'missing_argument', 'body.action');
    }

    const user = await this.kuzzle.ask(
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
    const refresh = this.getRefresh(request, 'wait_for');
    const userId = this.getString(request, 'userId');
    const apiKeyId = this.getId(request, ifMissingEnum.IGNORE);
    const description = this.getBodyString(request, 'description');

    const user = await this.ask('core:security:user:get', userId);
    const creatorId = this.getUserId(request);

    const apiKey = await ApiKey.create(user, expiresIn, description, {
      apiKeyId,
      creatorId,
      refresh,
    });

    this.kuzzle.log.info(`[SECURITY] User "${creatorId}" applied action "${request.input.action}" on user "${userId}."`);
    return apiKey.serialize({ includeToken: true });
  }

  /**
   * Search in an user API keys
   */
  async searchApiKeys (request) {
    const userId = this.getString(request, 'userId');
    const query = this.getBody(request, {});
    const { from, size, scrollTTL } = this.getSearchParams(request);

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
    const userId = this.getString(request, 'userId');
    const apiKeyId = this.getId(request);
    const refresh = this.getRefresh(request, 'wait_for');

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
    const { properties } = await this.kuzzle.internalIndex.getMapping('roles');

    return { mapping: properties };
  }

  /**
   * Update the roles collection mapping
   * @param {Request} request
   * @returns {Promise}
   */
  async updateRoleMapping (request) {
    const mappings = this.getBody(request);

    return this.kuzzle.internalIndex.updateMapping('roles', mappings);
  }

  /**
   * Get the profile mapping
   *
   * @returns {Promise}
   */
  async getProfileMapping () {
    const {properties} = await this.kuzzle.internalIndex.getMapping('profiles');

    return {mapping: properties};
  }

  /**
   * Update the profiles collection mapping

   * @param {Request} request
   * @returns {Promise}
   */
  updateProfileMapping (request) {
    const mappings = this.getBody(request);

    return this.kuzzle.internalIndex.updateMapping('profiles', mappings);
  }

  /**
   * Get the user mapping
   *
   * @returns {Promise}
   */
  async getUserMapping () {
    const {properties} = await this.kuzzle.internalIndex.getMapping('users');

    return {mapping: properties};
  }

  /**
   * Update the users collection mapping

   * @param {Request} request
   * @returns {Promise}
   */
  async updateUserMapping (request) {
    const mappings = this.getBody(request);

    return this.kuzzle.internalIndex.updateMapping('users', mappings);
  }

  /**
   * Get a specific role according to the given id
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async getRole(request) {
    const id = this.getId(request);

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
    const ids = this.getBodyArray(request, 'ids');
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
    const collection = this.getCollection(request);

    if (!this.securityCollections.includes(collection)) {
      throw kerror.get(
        'api',
        'assert',
        'unexpected_argument',
        collection,
        this.securityCollections);
    }

    await this.kuzzle.internalIndex.refreshCollection(collection);

    return null;
  }

  /**
   * Return a list of roles that specify a right for the given indexes
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async searchRoles(request) {
    const from = this.getInteger(request, 'from', 0);
    const size = this._getSearchPageSize(request);
    const controllers = this.getBodyArray(request, 'controllers', []);

    const response = await this.ask(
      'core:security:role:search',
      controllers,
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
    const id = this.getId(request);
    const body = this.getBody(request);
    const userId = this.getUserId(request);

    const role = await this.ask('core:security:role:createOrReplace', id, body, {
      force: this.getBoolean(request, 'force'),
      refresh: this.getRefresh(request, 'wait_for'),
      userId,
    });

    this.kuzzle.log.info(`[SECURITY] User "${userId}" applied action "${request.input.action}" on role "${role._id}."`);
    return formatProcessing.serializeRole(role);
  }

  /**
   * Create a Role
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async createRole(request) {
    const id = this.getId(request);
    const body = this.getBody(request);
    const userId = this.getUserId(request);

    const role = await this.ask('core:security:role:create', id, body, {
      force: this.getBoolean(request, 'force'),
      refresh: this.getRefresh(request, 'wait_for'),
      userId,
    });

    this.kuzzle.log.info(`[SECURITY] User "${userId}" applied action "${request.input.action}" on role "${role._id}."`);
    return formatProcessing.serializeRole(role);
  }

  /**
   * Remove a role according to the given id
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async deleteRole(request) {
    const id = this.getId(request);

    await this.ask('core:security:role:delete', id, {
      refresh: this.getRefresh(request, 'wait_for')
    });

    this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" applied action "${request.input.action} on role "${id}."`);

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
    const id = this.getId(request);

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
    const ids = this.getBodyArray(request, 'ids');

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
    const id = this.getId(request);
    const content = this.getBody(request);
    const userId = this.getUserId(request);

    // Assert: must have a "policies" array
    this.getBodyArray(request, 'policies');

    const profile = await this.ask(
      'core:security:profile:createOrReplace',
      id,
      content,
      {
        refresh: this.getRefresh(request, 'wait_for'),
        strict: this.getBoolean(request, 'strict'),
        userId,
      });

    this.kuzzle.log.info(`[SECURITY] User "${userId}" applied action "${request.input.action}" on profile "${profile._id}."`);

    return formatProcessing.serializeProfile(profile);
  }

  /**
   * Create a Profile
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async createProfile (request) {
    const id = this.getId(request);
    const content = this.getBody(request);
    const userId = this.getUserId(request);

    // Assert: must have a "policies" array
    this.getBodyArray(request, 'policies');

    const profile = await this.ask(
      'core:security:profile:create',
      id,
      content,
      {
        refresh: this.getRefresh(request, 'wait_for'),
        strict: this.getBoolean(request, 'strict'),
        userId,
      });

    this.kuzzle.log.info(`[SECURITY] User "${userId}" applied action "${request.input.action}" on profile "${profile._id}."`);

    return formatProcessing.serializeProfile(profile);
  }

  /**
   * Deletes a profile
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async deleteProfile(request) {
    const id = this.getId(request);
    const userId = this.getUserId(request);
    const options = {
      onAssignedUsers: this.getString(request, 'onAssignedUsers', 'fail'),
      refresh: this.getRefresh(request, 'wait_for'),
      userId };

    await this.ask('core:security:profile:delete', id, options);

    this.kuzzle.log.info(`[SECURITY] User "${userId}" applied action "${request.input.action}" on profile "${id}."`);

    // @todo - replace by an acknowledgement
    return { _id: id };
  }

  /**
   * Returns a list of profiles that contain a given set of roles
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async searchProfiles(request) {
    const roles = this.getBodyArray(request, 'roles', []);
    const from = this.getInteger(request, 'from', 0);
    const size = this._getSearchPageSize(request);
    const scroll = this.getScrollTTLParam(request);

    const response = await this.ask('core:security:profile:search', roles, {
      from,
      scroll,
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
    const id = this.getId(request);
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
      ids = this.getBodyArray(request, 'ids');
    }
    else {
      ids = this.getString(request, 'ids').split(',');
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
    const id = this.getId(request);

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
    const id = this.getId(request);

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
   * Returns the User objects matching the given query
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async searchUsers(request) {
    const size = this._getSearchPageSize(request);
    const { from, scrollTTL, searchBody } = this.getSearchParams(request);

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
   * Deletes a user from Kuzzle
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async deleteUser(request) {
    const id = this.getId(request);
    const options = { refresh: this.getRefresh(request, 'wait_for') };

    await this.ask('core:security:user:delete', id, options);

    this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" applied action "${request.input.action}" on user "${id}."`);

    return { _id: id };
  }

  /**
   * Creates a new User object in Kuzzle's database layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async createUser(request) {
    const content = this.getBodyObject(request, 'content');
    const profileIds = get(content, 'profileIds');

    if (profileIds === undefined) {
      throw kerror.get('api', 'assert', 'missing_argument', 'body.content.profileIds');
    }

    if (!Array.isArray(profileIds)) {
      throw kerror.get('api', 'assert', 'invalid_type', 'body.content.profileIds', 'array');
    }

    return this._persistUser(request, profileIds, content);
  }

  /**
   * Creates a new User object in Kuzzle's database layer and applies restricted profileIds
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async createRestrictedUser(request) {
    const content = this.getBodyObject(request, 'content', {});

    if (has(content, 'profileIds')) {
      throw kerror.get('api', 'assert', 'forbidden_argument', 'body.content.profileIds');
    }

    return this._persistUser(
      request,
      this.kuzzle.config.security.restrictedProfileIds,
      content);
  }

  /**
   * Updates an existing User
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async updateUser(request) {
    const id = this.getId(request);
    const content = this.getBody(request);
    const userId = this.getUserId(request);
    const profileIds = isNil(content.profileIds)
      ? null
      : this.getBodyArray(request, 'profileIds');

    const updated = await this.ask(
      'core:security:user:update',
      id,
      profileIds,
      content,
      {
        refresh: this.getRefresh(request, 'wait_for'),
        retryOnConflict: this.getInteger(request, 'retryOnConflict', 10),
        userId,
      });

    this.kuzzle.log.info(`[SECURITY] User "${userId}" applied action "${request.input.action}" on user "${id}."`);

    return formatProcessing.serializeUser(updated);
  }

  /**
   * Replaces an existing User
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async replaceUser (request) {
    const id = this.getId(request);
    const content = this.getBody(request);
    const profileIds = this.getBodyArray(request, 'profileIds');
    const userId = this.getUserId(request);

    const user = await this.ask(
      'core:security:user:replace',
      id,
      profileIds,
      content,
      { refresh: this.getRefresh(request, 'wait_for'), userId });

    this.kuzzle.log.info(`[SECURITY] User "${userId}" applied action "${request.input.action}" on user "${id}."`);

    return formatProcessing.serializeUser(user);
  }

  /**
   * Updates an existing profile
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async updateProfile(request) {
    const id = this.getId(request);
    const body = this.getBody(request);
    const userId = this.getUserId(request);

    const updated = await this.ask('core:security:profile:update', id, body, {
      refresh: this.getRefresh(request, 'wait_for'),
      retryOnConflict: this.getInteger(request, 'retryOnConflict', 10),
      strict: this.getBoolean(request, 'strict'),
      userId,
    });

    this.kuzzle.log.info(`[SECURITY] User "${userId}" applied action "${request.input.action}" on profile "${id}."`);
    return formatProcessing.serializeProfile(updated);
  }

  /**
   * Updates an existing role
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async updateRole(request) {
    const id = this.getId(request);
    const body = this.getBody(request);
    const userId = this.getUserId(request);

    const updated = await this.ask('core:security:role:update', id, body, {
      force: this.getBoolean(request, 'force'),
      refresh: this.getRefresh(request, 'wait_for'),
      retryOnConflict: this.getInteger(request, 'retryOnConflict', 10),
      userId,
    });

    this.kuzzle.log.info(`[SECURITY] User "${userId}" applied action "${request.input.action}" on role "${id}."`);

    return formatProcessing.serializeRole(updated);
  }

  /**
   * Creates the first admin user if it does not already exist
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async createFirstAdmin (request) {
    const adminExists = await this.kuzzle.ask('core:security:user:admin:exist');

    if (adminExists) {
      throw kerror.get('api', 'process', 'admin_exists');
    }

    const userId = this.getUserId(request);
    const content = this.getBodyObject(request, 'content', {});
    const reset = this.getBoolean(request, 'reset');

    if (has(content, 'profileIds')) {
      throw kerror.get('api', 'assert', 'forbidden_argument', 'body.content.profileIds');
    }

    const user = await this._persistUser(request, [ 'admin' ], content);

    if (reset) {
      for (const type of ['role', 'profile']) {
        await Bluebird.map(
          Object.entries(this.kuzzle.config.security.standard[`${type}s`]),
          ([name, value]) => this.ask(
            `core:security:${type}:createOrReplace`,
            name,
            value,
            { refresh: 'wait_for', userId }));
      }
    }

    this.kuzzle.log.info(`[SECURITY] User "${userId}" applied action "${request.input.action}".`);

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
    const id = this.getString(request, 'scrollId');
    const ttl = this.getScrollTTLParam(request);

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
    const id = this.getString(request, 'scrollId');
    const ttl = this.getScrollTTLParam(request);

    const response = await this.ask('core:security:profile:scroll', id, ttl);

    response.hits = response.hits.map(formatProcessing.serializeProfile);

    return response;
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async createCredentials(request) {
    const id = this.getId(request);
    const body = this.getBody(request);
    const strategy = this.getString(request, 'strategy');

    this.assertIsStrategyRegistered(strategy);

    // Throws if the user doesn't exist
    await this.ask('core:security:user:get', id);

    const validateMethod = this.getStrategyMethod(strategy, 'validate');

    await validateMethod(request, body, id, strategy, false);

    const createMethod = this.getStrategyMethod(strategy, 'create');

    this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" applied action "${request.input.action}" on user "${id}."`);
    return createMethod(request, body, id, strategy);
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async updateCredentials(request) {
    const id = this.getId(request);
    const body = this.getBody(request);
    const strategy = this.getString(request, 'strategy');

    this.assertIsStrategyRegistered(strategy);

    // Throws if the user doesn't exist
    await this.ask('core:security:user:get', id);

    const validateMethod = this.getStrategyMethod(strategy, 'validate');

    await validateMethod(request, body, id, strategy, true);

    const updateMethod = this.getStrategyMethod(strategy, 'update');

    this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" applied action "${request.input.action}" on user "${id}."`);

    return updateMethod(request, body, id, strategy);
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  async hasCredentials(request) {
    const id = this.getId(request);
    const strategy = this.getString(request, 'strategy');

    this.assertIsStrategyRegistered(strategy);

    const existsMethod = this.getStrategyMethod(strategy, 'exists');

    return existsMethod(request, id, strategy);
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  async validateCredentials(request) {
    const strategy = this.getString(request, 'strategy');

    this.assertIsStrategyRegistered(strategy);

    const validateMethod = this.getStrategyMethod(strategy, 'validate');

    return validateMethod(
      request,
      this.getBody(request),
      this.getId(request, {ifMissing: 'ignore'}),
      strategy,
      false);
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async deleteCredentials(request) {
    const id = this.getId(request);
    const strategy = this.getString(request, 'strategy');

    this.assertIsStrategyRegistered(strategy);

    const deleteMethod = this.getStrategyMethod(strategy, 'delete');

    await deleteMethod(request, id, strategy);

    this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" applied action "${request.input.action}" on user "${id}."`);

    return {acknowledged: true};
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async getCredentials(request) {
    const id = this.getId(request);
    const strategy = this.getString(request, 'strategy');

    this.assertIsStrategyRegistered(strategy);

    if (this.kuzzle.pluginsManager.hasStrategyMethod(strategy, 'getInfo')) {
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
    const id = this.getId(request);
    const strategy = this.getString(request, 'strategy');

    this.assertIsStrategyRegistered(strategy);

    if (this.kuzzle.pluginsManager.hasStrategyMethod(strategy, 'getById')) {
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
    const strategy = this.getString(request, 'strategy');

    this.assertIsStrategyRegistered(strategy);

    return this.kuzzle.pluginsManager.getStrategyFields(strategy);
  }

  /**
   * @returns {Promise<Object>}
   */
  async getAllCredentialFields() {
    const strategyFields = {};

    this.kuzzle.pluginsManager.listStrategies()
      .forEach(strategy => {
        strategyFields[strategy] =
          this.kuzzle.pluginsManager.getStrategyFields(strategy);
      });

    return strategyFields;
  }

  /**
   * @param {Request} request
   * @returns {Promise.<null>}
   */
  async revokeTokens(request) {
    const id = this.getId(request);

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
    const ids = this.getBodyArray(request, 'ids');
    const refresh = this.getRefresh(request, 'wait_for');

    if (ids.length > this.kuzzle.config.limits.documentsWriteCount) {
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
      this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" deleted the following ${type}s: ${successes.slice(0, 1000).join(', ')}... (${successes.length - 1000} more users deleted)."`);
    }
    else {
      this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" deleted the following ${type}s: ${successes.join(', ')}."`);
    }

    return successes;
  }

  /**
   * @param {Request} request
   * @returns {Promise}
   * @private
   */
  async _persistUser(request, profileIds, content) {
    const id = this.getId(request, ifMissingEnum.GENERATE);
    const credentials = this.getBodyObject(request, 'credentials', {});
    const strategies = Object.keys(credentials);

    // Early checks before the user is created
    if (id) {
      for (const strategy of strategies) {
        if (!this.kuzzle.pluginsManager.listStrategies().includes(strategy)) {
          throw kerror.get(
            'security',
            'credentials',
            'unknown_strategy',
            strategy);
        }

        const exists = this.getStrategyMethod(strategy, 'exists');
        if (await exists(request, id, strategy)) {
          throw kerror.get(
            'security',
            'credentials',
            'database_inconsistency',
            id);
        }
      }
    }

    const user = await this.ask(
      'core:security:user:create',
      id,
      profileIds,
      content,
      { refresh: this.getRefresh(request, 'wait_for') });

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
      this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" applied action "${request.input.action}" on user "${id}."`);
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
      this.kuzzle.log.error(`User rollback error: ${e}`);
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
    const size = this.getInteger(
      request,
      'size',
      this.kuzzle.config.limits.documentsFetchCount);

    this.assertNotExceedMaxFetch(size);

    return size;
  }
}

module.exports = SecurityController;
