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

const { isEmpty } = require('lodash');

const NativeSecurityController = require('./base/nativeSecurityController');
const formatProcessing = require('../../core/auth/formatProcessing');
const ApiKey = require('../../model/storage/apiKey');
const kerror = require('../../kerror');

/**
 * @class SecurityController
 */
class SecurityController extends NativeSecurityController {
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

    // @deprecated - helper, will be loosely coupled in the near future
    this.getStrategyMethod = global.kuzzle.pluginsManager.getStrategyMethod
      .bind(global.kuzzle.pluginsManager);
  }

  /**
   * Checks if an API action can be executed by a user
   * @deprecated use `UserController.checkRights` instead
   */
  async checkRights (request) {
    const userController = global.kuzzle.funnel.controllers.get('user');

    request.addDeprecation('2.13.0', 'security:checkRights has been deprecated since Kuzzle version 2.13.0. This feature might be removed in a future major version. To check if an API action can be executed by a user, use this API action instead: "user:checkRights".');

    return userController.checkRights(request);
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
   * @deprecated use `UserController.mappings` instead
   */
  async getUserMapping (request) {
    const userController = global.kuzzle.funnel.controllers.get('user');

    request.addDeprecation('2.13.0', 'security:getUserMapping has been deprecated since Kuzzle version 2.13.0. This feature might be removed in a future major version. To get user mappings, use this API action instead: "user:mappings".');

    return userController.mappings();
  }

  /**
   * Update the users collection mapping

   * @param {Request} request
   * @returns {Promise}
   * @deprecated use `UserController.updateMappings` instead
   */
  async updateUserMapping (request) {
    const userController = global.kuzzle.funnel.controllers.get('user');

    request.addDeprecation('2.13.0', 'security:updateUserMapping has been deprecated since Kuzzle version 2.13.0. This feature might be removed in a future major version. To update user mappings, use this API action instead: "user:updateMappings".');

    return userController.updateMappings(request);
  }

  /**
   * Get a specific role according to the given id
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async getRole (request) {
    return this._get('role', request);
  }

  /**
   * Get specific roles according to given ids
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async mGetRoles (request) {
    return this._mGet('role', request.getBodyArray('ids'));
  }

  /**
   * Refresh 'profiles' or 'roles' collection (also 'users' but deprecated)
   *
   * @param {Request} request
   * @returns {Promise}
   */
  async refresh (request) {
    const collection = request.getCollection();

    if (collection === 'users') {
      request.addDeprecation('2.13.0', 'This action has been deprecated since Kuzzle version 2.13.0. This feature might be removed in a future major version. To refresh users collection, use this API action instead: "user:refresh".');
    }

    return this._refresh(collection);
  }

  /**
   * Return a list of roles that specify a right for the given indexes
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async searchRoles (request) {
    const { from, size } = request.getSearchParams({ defaultSize: -1 });
    const controllers = request.getBodyArray('controllers', []);

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
  async createOrReplaceRole (request) {
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
  async deleteRole (request) {
    return this._delete('role', request);
  }

  /**
   * Get a specific profile according to the given id
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async getProfile (request) {
    return this._get('profile', request);
  }

  /**
   * Get specific profiles according to given ids
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async mGetProfiles (request) {
    return this._mGet('profile', request.getBodyArray('ids'));
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
  async deleteProfile (request) {
    const options = {
      onAssignedUsers: request.getString('onAssignedUsers', 'fail'),
      refresh: request.getRefresh('wait_for'),
      userId: request.getKuid()
    };

    return this._delete('profile', request, options);
  }

  /**
   * Returns a list of profiles that contain a given set of roles
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async searchProfiles (request) {
    const { from, size, scrollTTL: scroll } = request.getSearchParams({ defaultSize: -1 });
    const roles = request.getBodyArray('roles', []);

    const response = await this.ask(
      'core:security:profile:search',
      roles,
      { from, scroll, size }
    );

    response.hits = response.hits.map(formatProcessing.serializeProfile);

    return response;
  }

  /**
   * Given a user id, returns the matching User object
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   * @deprecated use `UserController.get` instead
   */
  async getUser (request) {
    const userController = global.kuzzle.funnel.controllers.get('user');

    request.addDeprecation('2.13.0', 'security:getUser has been deprecated since Kuzzle version 2.13.0. This feature might be removed in a future major version. To get a user, use this API action instead: "user:get".');

    return userController.get(request);
  }

  /**
   * Get specific users according to given ids
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   * @deprecated use `UserController.mGet` instead
   */
  async mGetUsers(request) {
    const userController = global.kuzzle.funnel.controllers.get('user');

    request.addDeprecation('2.13.0', 'security:mGet has been deprecated since Kuzzle version 2.13.0. This feature might be removed in a future major version. To get multiple users, use this API action instead: "user:mGet".');

    return userController.mGet(request);
  }

  /**
   * Given a profile id, returns the matching profile's rights as an array.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async getProfileRights (request) {
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
   * @deprecated use `UserController.rights` instead
   */
  async getUserRights (request) {
    const userController = global.kuzzle.funnel.controllers.get('user');

    request.addDeprecation('2.13.0', 'security:getUserRights has been deprecated since Kuzzle version 2.13.0. This feature might be removed in a future major version. To get user rights, use this API action instead: "user:rights".');

    return userController.rights(request);
  }

  /**
   * Given a user id, returns the matching user's strategies as an array.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   * @deprecated use `UserController.strategies` instead
   */
  async getUserStrategies(request) {
    const userController = global.kuzzle.funnel.controllers.get('user');

    request.addDeprecation('2.13.0', 'security:getUserStrategies has been deprecated since Kuzzle version 2.13.0. This feature might be removed in a future major version. To get user strategies, use this API action instead: "user:strategies".');

    return userController.strategies(request);
  }

  /**
   * Returns the User objects matching the given query
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   * @deprecated use `UserController.search` instead
   */
  async searchUsers (request) {
    const userController = global.kuzzle.funnel.controllers.get('user');

    request.addDeprecation('2.13.0', 'security:searchUsers has been deprecated since Kuzzle version 2.13.0. This feature might be removed in a future major version. To search users, use this API action instead: "user:search".');

    return userController.search(request);
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
    const { from, size, searchBody } = request.getSearchParams({ defaultSize: -1 });

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
   * @deprecated use `UserController.delete` instead
   */
  async deleteUser (request) {
    const userController = global.kuzzle.funnel.controllers.get('user');

    request.addDeprecation('2.13.0', 'security:deleteUsers has been deprecated since Kuzzle version 2.13.0. This feature might be removed in a future major version. To delete a user, use this API action instead: "user:delete".');

    return userController.delete(request);
  }

  /**
   * Creates a new User object in Kuzzle's database layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   * @deprecated use `UserController.create` instead
   */
  async createUser (request) {
    const userController = global.kuzzle.funnel.controllers.get('user');

    request.addDeprecation('2.13.0', 'security:createUser has been deprecated since Kuzzle version 2.13.0. This feature might be removed in a future major version. To create a new user, use this API action instead: "user:create".');

    return userController.create(request);
  }

  /**
   * Creates a new User object in Kuzzle's database layer and applies restricted profileIds
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   * @deprecated use `UserController.createRestricted` instead
   */
  async createRestrictedUser (request) {
    const userController = global.kuzzle.funnel.controllers.get('user');

    request.addDeprecation('2.13.0', 'security:createRestrictedUser has been deprecated since Kuzzle version 2.13.0. This feature might be removed in a future major version. To create a restricted user, use this API action instead: "user:createRestricted".');

    return userController.createRestricted(request);
  }

  /**
   * Updates an existing User
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   * @deprecated use `UserController.update` instead
   */
  async updateUser (request) {
    const userController = global.kuzzle.funnel.controllers.get('user');

    request.addDeprecation('2.13.0', 'security:updateUser has been deprecated since Kuzzle version 2.13.0. This feature might be removed in a future major version. To update a user, use this API action instead: "user:update".');

    return userController.update(request);
  }

  /**
   * Replaces an existing User
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   * @deprecated use `UserController.replace` instead
   */
  async replaceUser (request) {
    const userController = global.kuzzle.funnel.controllers.get('user');

    request.addDeprecation('2.13.0', 'security:replaceUser has been deprecated since Kuzzle version 2.13.0. This feature might be removed in a future major version. To replace a user, use this API action instead: "user:replace".');

    return userController.replace(request);
  }

  /**
   * Updates an existing profile
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async updateProfile (request) {
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
  async updateRole (request) {
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
   * @deprecated use `UserController.createFirstAdmin` instead
   */
  async createFirstAdmin (request) {
    const userController = global.kuzzle.funnel.controllers.get('user');

    request.addDeprecation('2.13.0', 'security:createFirstAdmin has been deprecated since Kuzzle version 2.13.0. This feature might be removed in a future major version. To create the first admin, use this API action instead: "user:createFirstAdmin".');

    return userController.createFirstAdmin(request);
  }

  /**
   * Deletes multiple profiles
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mDeleteProfiles (request) {
    return this._mDelete('profile', request);
  }

  /**
   * Deletes multiple roles
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mDeleteRoles (request) {
    return this._mDelete('role', request);
  }

  /**
   * Deletes multiple users
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   * @deprecated use `UserController.mDelete` instead
   */
  mDeleteUsers (request) {
    const userController = global.kuzzle.funnel.controllers.get('user');

    request.addDeprecation('2.13.0', 'security:mDeleteUsers has been deprecated since Kuzzle version 2.13.0. This feature might be removed in a future major version. To delete multiple users, use this API action instead: "user:mDelete".');

    return userController.mDelete(request);
  }

  /**
   * Scroll a paginated users search result
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   * @deprecated use `UserController.scroll` instead
   */
  async scrollUsers (request) {
    const userController = global.kuzzle.funnel.controllers.get('user');

    request.addDeprecation('2.13.0', 'security:scrollUsers has been deprecated since Kuzzle version 2.13.0. This feature might be removed in a future major version. To scroll users, use this API action instead: "user:scroll".');

    return userController.scroll(request);
  }

  /**
   * Scroll a paginated profiles search result
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async scrollProfiles (request) {
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
  async createCredentials (request) {
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
  async updateCredentials (request) {
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
  async hasCredentials (request) {
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
  async validateCredentials (request) {
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
  async deleteCredentials (request) {
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
  async getCredentials (request) {
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
  async getCredentialsById (request) {
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
  async getCredentialFields (request) {
    const strategy = request.getString('strategy');

    this.assertIsStrategyRegistered(strategy);

    return global.kuzzle.pluginsManager.getStrategyFields(strategy);
  }

  /**
   * @returns {Promise<Object>}
   */
  async getAllCredentialFields () {
    const strategyFields = {};

    global.kuzzle.pluginsManager.listStrategies()
      .forEach(strategy => {
        strategyFields[strategy] =
          global.kuzzle.pluginsManager.getStrategyFields(strategy);
      });

    return strategyFields;
  }

  /**
   * Revokes every token of a given user
   *
   * @param {Request} request
   * @returns {Promise.<null>}
   * @deprecated use `UserController.revokeTokens` instead
   */
  async revokeTokens (request) {
    const userController = global.kuzzle.funnel.controllers.get('user');

    request.addDeprecation('2.13.0', 'security:revokeTokens has been deprecated since Kuzzle version 2.13.0. This feature might be removed in a future major version. To revoke every tokens of a given user, use this API action instead: "user:revokeTokens".');

    return userController.revokeTokens(request);
  }
}

module.exports = SecurityController;
