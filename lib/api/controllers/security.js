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

const _ = require('lodash');
const { v4: uuid } = require('uuid');
const Bluebird = require('bluebird');
const { NativeController } = require('./base');
const formatProcessing = require('../../core/auth/formatProcessing');
const ApiKey = require('../../models/storage/apiKey');
const errorsManager = require('../../util/errors');
const {
  Request,
  errors: { KuzzleError }
} = require('kuzzle-common-objects');
const {
  assertHasBody,
  assertBodyHasAttribute,
  assertBodyAttributeType,
  assertContentAttributeType,
  assertContentHasAttribute,
  assertContentHasNotAttribute,
  assertHasId,
  assertIdStartsNotUnderscore,
  assertHasStrategy,
  assertHasScrollId,
  assertIsStrategyRegistered
} = require('../../util/requestAssertions');

/**
 * Gets the refresh value.
 * Default to 'wait_for' for security actions.
 *
 * @param {Request} request
 *
 * @returns {String}
 */
function getRefresh (request) {
  if ( request.input.args.refresh === false
    || request.input.args.refresh === 'false'
  ) {
    return 'false';
  }

  return 'wait_for';
}


/**
 * @param {Kuzzle} kuzzle
 * @constructor
 * @property {Kuzzle} kuzzle
 */
class SecurityController extends NativeController {
  constructor(kuzzle) {
    super(kuzzle, [
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

    this.internalIndex = this.kuzzle.storageEngine.config.internalIndex.name;
    this.securityCollections = ['users', 'profiles', 'roles'];
    this.getStrategyMethod = this.kuzzle.pluginsManager.getStrategyMethod;
  }

  /**
   * Creates a new API key for a user
   */
  async createApiKey (request) {
    const expiresIn = request.input.args.expiresIn || -1;
    const refresh = getRefresh(request);
    const userId = this.getString(request, 'userId');
    const apiKeyId = request.input.resource._id || null;
    const description = this.getBodyString(request, 'description');

    const user = await this.ask('core:security:users:get', userId);
    const connectionId = request.context.connection.id;
    const creatorId = this.getUserId(request);

    const apiKey = await ApiKey.create(
      user,
      connectionId,
      expiresIn,
      description,
      { apiKeyId, creatorId, refresh });

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
          must: _.isEmpty(query) ? { match_all: {} } : query
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
    const refresh = getRefresh(request);

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
  updateRoleMapping (request) {
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
  updateUserMapping (request) {
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
    assertHasId(request);

    const roleId = request.input.resource._id;
    const role = await this.ask('core:security:roles:get', roleId);

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

    const roles = await this.ask('core:security:roles:mGet', ids);

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
      throw errorsManager.get(
        'api',
        'assert',
        'unexpected_argument',
        collection,
        this.securityCollections);
    }

    await this.kuzzle.storageEngine.internal.refreshCollection(
      this.internalIndex,
      collection);

    return null;
  }

  /**
   * Return a list of roles that specify a right for the given indexes
   * @todo  - from and size should be deprecated, they don't make much sense
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async searchRoles(request) {
    const from = this.getInteger(request, 'from', 0);
    const size = this._getSearchPageSize(request);
    const controllers = this.getBodyArray(request, 'controllers', []);

    const response = await this.ask(
      'core:security:roles:search',
      controllers,
      from,
      size);

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

    const role = await this.ask('core:security:roles:createOrReplace', id, body, {
      force: this.getBoolean(request, 'force'),
      refresh: this.getRefresh(request),
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
    assertIdStartsNotUnderscore(request);
    const id = this.getId(request);
    const body = this.getBody(request);
    const userId = this.getUserId(request);

    const role = await this.ask('core:security:roles:create', id, body, {
      force: this.getBoolean(request, 'force'),
      refresh: this.getRefresh(request),
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

    await this.ask('core:security:roles:delete', id, {
      refresh: this.getRefresh(request)
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

    const profile = await this.ask('core:security:profiles:get', id);

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

    const profiles = await this.ask('core:security:profiles:mGet', ids);

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
    const policies = this.getBodyArray(request, 'policies');
    const userId = this.getUserId(request);

    assertIdStartsNotUnderscore(request);

    const profile = await this.ask(
      'core:security:profiles:createOrReplace',
      id,
      policies,
      {refresh: this.getRefresh(request), userId});

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
    const policies = this.getBodyArray(request, 'policies');
    const userId = this.getUserId(request);

    assertIdStartsNotUnderscore(request);

    const profile = await this.ask(
      'core:security:profiles:create',
      id,
      policies,
      {refresh: this.getRefresh(request), userId});

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
    const options = { refresh: this.getRefresh(request) };

    await this.ask('core:security:profiles:delete', id, options);

    this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" applied action "${request.input.action}" on profile "${id}."`);

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

    const response = await this.ask('core:security:profiles:search', roles, {
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
    const user = await this.ask('core:security:users:get', id);

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

    const users = await this.ask('core:security:users:mGet', ids);

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

    const profile = await this.ask('core:security:profiles:get', id);
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

    const user = await this.ask('core:security:users:get', id);
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

    const response = await this.ask('core:security:users:search', searchBody, {
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
    const options = { refresh: this.getRefresh(request) };

    await this.ask('core:security:users:delete', id, options);

    this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" applied action "${request.input.action}" on user "${id}."`);

    return { _id: id };
  }

  /**
   * Creates a new User object in Kuzzle's database layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  createUser(request) {
    const content = this.getBodyObject(request, 'content');

    assertIdStartsNotUnderscore(request);
    assertContentHasAttribute(request, 'profileIds');
    assertContentAttributeType(request, 'profileIds', 'array');

    // For future uses: profileIds and content shouldn't be corelated
    const profileIds = content.profileIds;
    delete content.profileIds; // /!\ do not set to undefined

    return this._persistUser(request, profileIds, content);
  }

  /**
   * Creates a new User object in Kuzzle's database layer and applies restricted profileIds
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  createRestrictedUser(request) {
    assertIdStartsNotUnderscore(request);
    assertHasBody(request);
    assertContentHasNotAttribute(request, 'profileIds');

    return this._persistUser(
      request,
      this.kuzzle.config.security.restrictedProfileIds,
      this.getBodyObject(request, 'content', {}));
  }

  /**
   * Updates an existing User
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  updateUser(request) {
    const id = this.getId(request);
    const content = this.getBody(request);
    const userId = this.getUserId(request);

    const updated = this.ask('core:security:users:update', id, content, {
      refresh: this.getRefresh(request),
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
    const userId = this.getUserId(request);
    assertBodyHasAttribute(request, 'profileIds');

    const user = await this.ask('core:security:users:replace', id, content, {
      refresh: this.getRefresh(request),
      userId,
    });

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

    const updated = await this.ask('core:security:profiles:update', id, body, {
      refresh: this.getRefresh(request),
      retryOnConflict: this.getInteger(request, 'retryOnConflict', 10),
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

    const updated = await this.ask('core:security:roles:update', id, body, {
      force: this.getBoolean(request, 'force'),
      refresh: this.getRefresh(request),
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
    assertIdStartsNotUnderscore(request);

    // @todo Will be replaced by a call to "kuzzle:adminExists"
    const adminExists = await this.kuzzle.adminExists();

    if (adminExists.exists) {
      throw errorsManager.get('api', 'process', 'admin_exists');
    }

    const user = await this._persistUser(
      request,
      [ 'admin' ],
      this.getBodyObject(request, 'content', {}));

    const reset = this.getBoolean(request, 'reset');

    if (reset) {
      for (const type of ['roles', 'profiles']) {
        await Bluebird.all(
          Object
            .entries(this.kuzzle.config.security.standard[type])
            .map(([name, content]) => this.ask(
              `core:security:${type}:createOrReplace`,
              name,
              content)));
      }

      await this.kuzzle.internalIndex.refreshCollection('users');
    }

    this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" applied action "${request.input.action}".`);

    return user;
  }

  /**
   * Deletes multiple profiles
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mDeleteProfiles(request) {
    return this.mDelete('profiles', request);
  }

  /**
   * Deletes multiple roles
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mDeleteRoles(request) {
    return this.mDelete('roles', request);
  }

  /**
   * Deletes multiple users
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mDeleteUsers(request) {
    return this.mDelete('users', request);
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

    const response = await this.ask('core:security:users:scroll', id, ttl);

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

    const response = await this.ask('core:security:profiles:scroll', id, ttl);

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

    this.assertIsStrategyRegistered(request);

    // Throws if the user doesn't exist
    await this.ask('core:security:users:get', id);

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

    this.assertIsStrategyRegistered(request);

    // Throws if the user doesn't exist
    await this.ask('core:security:users:get', id);

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

    this.assertIsStrategyRegistered(request);

    const existsMethod = this.getStrategyMethod(strategy, 'exists');

    return existsMethod(request, id, strategy);
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  validateCredentials(request) {
    const strategy = this.getString(request, 'strategy');

    this.assertIsStrategyRegistered(request);

    const validateMethod = this.getStrategyMethod(strategy, 'validate');

    // _id can be null on purpose
    return validateMethod(
      request,
      this.getBody(request),
      request.input.resource._id,
      strategy,
      false);
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  deleteCredentials(request) {
    assertHasStrategy(request);
    assertIsStrategyRegistered(this.kuzzle, request);
    assertHasId(request);

    const deleteMethod = this.kuzzle.pluginsManager.getStrategyMethod(
      request.input.args.strategy,
      'delete');

    return deleteMethod(request, request.input.resource._id, request.input.args.strategy)
      .then(() => {
        this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" applied action "${request.input.action}" on user "${request.input.resource._id}."`);
        return {acknowledged: true};
      });
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  getCredentials(request) {
    assertHasStrategy(request);
    assertIsStrategyRegistered(this.kuzzle, request);
    assertHasId(request);

    if (this.kuzzle.pluginsManager.hasStrategyMethod(request.input.args.strategy, 'getInfo')) {
      const getInfoMethod = this.kuzzle.pluginsManager.getStrategyMethod(
        request.input.args.strategy,
        'getInfo');

      return getInfoMethod(
        request,
        request.input.resource._id,
        request.input.args.strategy);
    }

    return Bluebird.resolve({});
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  getCredentialsById(request) {
    assertHasStrategy(request);
    assertIsStrategyRegistered(this.kuzzle, request);
    assertHasId(request);

    if (this.kuzzle.pluginsManager.hasStrategyMethod(request.input.args.strategy, 'getById')) {
      const getByIdMethod = this.kuzzle.pluginsManager.getStrategyMethod(
        request.input.args.strategy,
        'getById');

      return getByIdMethod(
        request,
        request.input.resource._id,
        request.input.args.strategy);
    }

    return Bluebird.resolve({});
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  getCredentialFields(request) {
    assertHasStrategy(request);
    assertIsStrategyRegistered(this.kuzzle, request);

    return Bluebird.resolve(this.kuzzle.pluginsManager.getStrategyFields(
      request.input.args.strategy));
  }

  /**
   * @returns {Promise<Object>}
   */
  getAllCredentialFields() {
    const strategyFields = {};

    this.kuzzle.pluginsManager.listStrategies()
      .forEach(strategy => {
        strategyFields[strategy] =
          this.kuzzle.pluginsManager.getStrategyFields(strategy);
      });

    return Bluebird.resolve(strategyFields);
  }

  /**
   * @param {Request} request
   * @returns {Promise<null>}
   */
  revokeTokens(request) {
    assertHasId(request);

    const userId = request.input.resource._id;
    return this.kuzzle.repositories.user.load(userId)
      .then(user => {
        if (!user) {
          throw errorsManager.get('security', 'user', 'not_found', userId);
        }
        this.kuzzle.repositories.token.deleteByUserId(userId);
        return null;
      });
  }

  /**
   * @param {string.<profile|role|user>} type
   * @param {Request} request
   * @returns {Promise<*>}
   */
  async mDelete (type, request) {
    const ids = this.getBodyArray(request, 'ids');
    const refresh = this.getRefresh(request);

    if (ids.length > this.kuzzle.config.limits.documentsWriteCount) {
      throw errorsManager.get('services', 'storage', 'write_limit_exceeded');
    }

    const successes = [];
    const errors = [];
    const promises = [];

    for (const id of ids) {
      promises.push(
        this.ask(`core:security:${type}:delete`, id, {refresh})
          .then(() => successes.push(id))
          .catch(err => errors.push(err)));
    }

    await Bluebird.all(promises);

    if (errors.length) {
      request.setError(
        errorsManager.get('services', 'storage', 'incomplete_delete', errors));
    }

    if (successes.length > 1000) {
      this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" deleted the following ${type} ${successes.slice(0, 1000).join(', ')}... (${successes.length - 1000} more users deleted)."`);
    }
    else {
      this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" deleted the following ${type} ${successes.join(', ')}."`);
    }

    return successes;
  }

  /**
   * Sets the metadata for an update request
   * @param {object} securityDocument
   * @param {Request} request
   * @returns {object}
   */
  updateMetadata(securityDocument, request) {
    if (!securityDocument) {
      return errorsManager.reject(
        'security',
        request.input.action.replace('update', '').toLowerCase(),
        'not_found',
        request.input.resource._id);
    }

    securityDocument._kuzzle_info = _.assign(securityDocument._kuzzle_info, {
      updatedAt: Date.now(),
      updater: this.getUserId(request)
    });
    return securityDocument;
  }

  /**
   * @param {Request} request
   * @returns {Promise}
   * @private
   */
  async _persistUser(request, profileIds, content) {
    const id = request.input.resource._id || uuid();
    const credentials = this.getBodyObject(request, 'credentials', {});
    const strategies = Object.keys(credentials);

    // Early checks before the user is created
    for (const strategy of strategies) {
      if (!this.kuzzle.pluginsManager.listStrategies().includes(strategy)) {
        throw errorsManager.get(
          'security',
          'credentials',
          'unknown_strategy',
          strategy);
      }

      const exists = this.getStrategyMethod(strategy, 'exists');
      if (await exists(request, id, strategy)) {
        throw errorsManager.get(
          'security',
          'credentials',
          'database_inconsistency',
          id);
      }
    }

    const user = await this.ask(
      'core:security:users:create',
      id,
      profileIds,
      content,
      { refresh: this.getRefresh(request) });
    const createdUser = formatProcessing.serializeUser(user);

    // Creating credentials
    let creationFailure = null;

    for (const strategy of strategies) {
      try {
        const validate = this.getStrategyMethod(strategy,'validate');

        await validate(request, credentials[strategy], id, strategy, false);
      }
      catch (error) {
        creationFailure = {error, strategy, validation: true};
        break;
      }

      try {
        const create = this.getStrategyMethod(strategy, 'create');

        await create(request, credentials[strategy], id, strategy);
      }
      catch (error) {
        creationFailure = {error, strategy};
        break;
      }
    }

    if (creationFailure === null) {
      this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" applied action "${request.input.action}" on user "${id}."`);
      return createdUser;
    }

    // Failed to create credentials: rollback + error management
    // We try to delete the errored strategy as well
    let deletionError = null;
    try {
      const del = this.getStrategyMethod(creationFailure.strategy, 'delete');

      await del(request, id, creationFailure.strategy);
    }
    catch (e) {
      // We catch any error produced by delete as we want to make as much
      // cleanup as possible
      deletionError = e;
    }

    try {
      this.ask('core:security:users:delete', id);
    }
    catch (e) {
      this.kuzzle.log.error(`User rollback error: ${e}`);
    }

    if (deletionError) {
      // 2 errors > we
      throw errorsManager.get(
        'plugin',
        'runtime',
        'unexpected_error',
        [
          creationFailure.error.message,
          deletionError.message
        ].join('\n'));
    }

    if (creationFailure.error instanceof KuzzleError) {
      throw creationFailure.error;
    }

    if (creationFailure.validation) {
      throw errorsManager.getFrom(
        creationFailure.error,
        'security',
        'credentials',
        'rejected',
        creationFailure.error.message);
    }

    throw errorsManager.getFrom(
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
  }
}

module.exports = SecurityController;
