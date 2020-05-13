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

const
  _ = require('lodash'),
  { v4: uuid } = require('uuid'),
  Bluebird = require('bluebird'),
  { NativeController } = require('./base'),
  formatProcessing = require('../../core/auth/formatProcessing'),
  ApiKey = require('../../models/storage/apiKey'),
  errorsManager = require('../../util/errors'),
  {
    Request,
    errors: { KuzzleError }
  } = require('kuzzle-common-objects'),
  {
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
  }

  /**
   * Creates a new API key for an user
   */
  async createApiKey (request) {
    const
      expiresIn = request.input.args.expiresIn || -1,
      refresh = getRefresh(request),
      userId = this.getString(request, 'userId'),
      apiKeyId = request.input.resource._id || null,
      description = this.getBodyString(request, 'description');

    const
      user = await this.kuzzle.repositories.user.load(userId),
      connectionId = request.context.connection.id,
      creatorId = this.getUserId(request);

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
    const
      userId = this.getString(request, 'userId'),
      query = this.getBody(request, {}),
      { from, size, scrollTTL } = this.getSearchParams(request);

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
    const
      userId = this.getString(request, 'userId'),
      apiKeyId = this.getId(request),
      refresh = getRefresh(request);

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
  getRoleMapping () {
    return this.kuzzle.internalIndex.getMapping('roles')
      .then(({ properties }) => ({
        mapping: properties
      }));
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
  getProfileMapping () {
    return this.kuzzle.internalIndex.getMapping('profiles')
      .then(({ properties }) => ({
        mapping: properties
      }));
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
  getUserMapping () {
    return this.kuzzle.internalIndex.getMapping('users')
      .then(({ properties }) => ({
        mapping: properties
      }));
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
  getRole(request) {
    assertHasId(request);

    return this.kuzzle.repositories.role.load(request.input.resource._id)
      .then(role => {
        if (!role) {
          throw errorsManager.get(
            'security',
            'role',
            'not_found',
            request.input.resource._id);
        }

        return formatProcessing.serializeRole(role);
      });
  }

  /**
   * Get specific roles according to given ids
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mGetRoles(request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'ids');
    assertBodyAttributeType(request, 'ids', 'array');

    return this.kuzzle.repositories.role
      .loadMultiFromDatabase(request.input.body.ids)
      .then(roles => {
        const formatted = roles.map(formatProcessing.serializeRole);

        return { hits: formatted };
      });
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
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  searchRoles(request) {
    checkSearchPageLimit(request, this.kuzzle.config.limits.documentsFetchCount);

    const
      controllers = request.input.body && request.input.body.controllers,
      from = request.input.args
        && request.input.args.from
        && Number(request.input.args.from),
      size = request.input.args
        && request.input.args.size
        && Number(request.input.args.size);

    return this.kuzzle.repositories.role.searchRole(controllers, from, size)
      .then(response => {
        response.hits = response.hits.map(formatProcessing.serializeRole);
        return response;
      });
  }

  /**
   * Create or replace a Role
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  createOrReplaceRole(request) {
    assertHasBody(request);
    assertHasId(request);

    return createOrReplaceRole(
      this.kuzzle.repositories.role,
      request,
      {
        force: this.getBoolean(request, 'force'),
        method: 'createOrReplace',
        refresh: getRefresh(request)
      }
    )
      .then(role => {
        this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" applied action "${request.input.action}" on role "${role._id}."`);
        return formatProcessing.serializeRole(role);
      });
  }

  /**
   * Create a Role
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  createRole(request) {
    assertHasBody(request);
    assertHasId(request);
    assertIdStartsNotUnderscore(request);

    return createOrReplaceRole(
      this.kuzzle.repositories.role,
      request,
      {
        force: this.getBoolean(request, 'force'),
        method: 'create',
        refresh: getRefresh(request)
      }
    )
      .then(role => {
        this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" applied action "${request.input.action}" on role "${role._id}."`);
        return formatProcessing.serializeRole(role);
      });
  }

  /**
   * Remove a role according to the given id
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  deleteRole(request) {
    assertHasId(request);

    const options = { refresh: getRefresh(request) };

    return this.kuzzle.repositories.role.load(request.input.resource._id)
      .then(role =>
      {
        this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" applied action "${request.input.action} on role "${role._id}."`);
        return this.kuzzle.repositories.role.delete(role, options);
      });
  }

  /**
   * Get a specific profile according to the given id
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  getProfile(request) {
    assertHasId(request);

    return this.kuzzle.repositories.profile.load(request.input.resource._id)
      .then(profile => {
        if (!profile) {
          throw errorsManager.get(
            'security',
            'profile',
            'not_found',
            request.input.resource._id);
        }

        return formatProcessing.serializeProfile(profile);
      });
  }

  /**
   * Get specific profiles according to given ids
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mGetProfiles(request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'ids');
    assertBodyAttributeType(request, 'ids', 'array');

    return this.kuzzle.repositories.profile.loadMultiFromDatabase(
      request.input.body.ids
    )
      .then(profiles => {
        const formatted = profiles.map(
          profile => formatProcessing.serializeProfile(profile));

        return { hits: formatted };
      });
  }

  /**
   * Create or replace a Profile
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  createOrReplaceProfile(request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'policies');
    assertBodyAttributeType(request, 'policies', 'array');
    assertHasId(request);
    assertIdStartsNotUnderscore(request);

    return createOrReplaceProfile(
      this.kuzzle.repositories.profile,
      request,
      {
        method: 'createOrReplace',
        refresh: getRefresh(request)
      }
    )
      .then(profile => {
        this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" applied action "${request.input.action}" on profile "${profile._id}."`);
        return formatProcessing.serializeProfile(profile);}
      );
  }

  /**
   * Create a Profile
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  createProfile(request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'policies');
    assertBodyAttributeType(request, 'policies', 'array');
    assertHasId(request);
    assertIdStartsNotUnderscore(request);

    return createOrReplaceProfile(
      this.kuzzle.repositories.profile,
      request,
      {
        method: 'create',
        refresh: getRefresh(request)
      }
    )
      .then(profile => {
        this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" applied action "${request.input.action}" on profile "${profile._id}."`);
        return formatProcessing.serializeProfile(profile);
      });
  }

  /**
   * Deletes a profile
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  deleteProfile(request) {
    assertHasId(request);

    const options = { refresh: getRefresh(request) };

    return this.kuzzle.repositories.profile.load(request.input.resource._id)
      .then(profile => {
        this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" applied action "${request.input.action}" on profile "${profile._id}."`);
        return this.kuzzle.repositories.profile.delete(profile, options);
      });
  }

  /**
   * Returns a list of profiles that contain a given set of roles
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  searchProfiles(request) {
    let roles = [];

    checkSearchPageLimit(
      request,
      this.kuzzle.config.limits.documentsFetchCount
    );

    if (request.input.body && request.input.body.roles) {
      roles = request.input.body.roles;
    }

    return this.kuzzle.repositories.profile
      .searchProfiles(roles, request.input.args)
      .then(response => {
        response.hits = response.hits.map(formatProcessing.serializeProfile);

        return response;
      });
  }

  /**
   * Given a user id, returns the matching User object
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  getUser(request) {
    assertHasId(request);

    return this.kuzzle.repositories.user.load(request.input.resource._id)
      .then(user => {
        if (!user) {
          throw errorsManager.get(
            'security',
            'user',
            'not_found',
            request.input.resource._id);
        }

        return formatProcessing.serializeUser(user);
      });
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
    const users = await this.kuzzle.repositories.user.loadMultiFromDatabase(ids);
    const formatted = users.map(user => formatProcessing.serializeUser(user));
    return { hits: formatted };
  }

  /**
   * Given a profile id, returns the matching profile's rights as an array.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  getProfileRights(request) {
    assertHasId(request);

    return this.kuzzle.repositories.profile.load(request.input.resource._id)
      .then(profile => {
        if (!profile) {
          throw errorsManager.get(
            'security',
            'profile',
            'not_found',
            request.input.resource._id);
        }

        return profile.getRights();
      })
      .then(rights => Object.keys(rights)
        .reduce((array, item) => array.concat(rights[item]), [])
      )
      .then(rights => ({hits: rights, total: rights.length}));
  }

  /**
   * Given a user id, returns the matching user's rights as an array.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  getUserRights(request) {
    assertHasId(request);

    return this.kuzzle.repositories.user.load(request.input.resource._id)
      .then(user => {
        if (!user) {
          throw errorsManager.get(
            'security',
            'user',
            'not_found',
            request.input.resource._id);
        }

        return user.getRights(this.kuzzle);
      })
      .then(rights =>
        Object.keys(rights).reduce((array, item) => array.concat(rights[item]), [])
      )
      .then(rights => ({hits: rights, total: rights.length}));
  }

  /**
   * Returns the User objects matching the given query
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  searchUsers(request) {
    checkSearchPageLimit(
      request,
      this.kuzzle.config.limits.documentsFetchCount);

    const { from, size, scrollTTL, searchBody } = this.getSearchParams(request);

    return this.kuzzle.repositories.user
      .search(searchBody, { from, scroll: scrollTTL, size })
      .then(response => {
        const hits = response.hits.map(formatProcessing.serializeUser);

        return {
          hits,
          scrollId: response.scrollId,
          total: response.total
        };
      });
  }

  /**
   * Deletes a User from Kuzzle
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async deleteUser(request) {
    const
      userId = this.getId(request),
      options = { refresh: getRefresh(request) };

    const user = await this.kuzzle.repositories.user.load(userId);

    await this.kuzzle.repositories.user.delete(user, options);

    this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" applied action "${request.input.action}" on user "${userId}."`);
    return {
      _id: userId
    };
  }

  /**
   * Creates a new User object in Kuzzle's database layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  createUser(request) {
    assertHasBody(request);
    assertIdStartsNotUnderscore(request);
    assertBodyHasAttribute(request, 'content');
    assertBodyAttributeType(request, 'content', 'object');
    assertContentHasAttribute(request, 'profileIds');
    assertContentAttributeType(request, 'profileIds', 'array');

    if (request.input.body.credentials) {
      assertBodyAttributeType(request, 'credentials', 'object');
    }

    const pojoUser = request.input.body.content;
    pojoUser._id = request.input.resource._id || uuid();

    this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" applied action "${request.input.action}" on user "${pojoUser._id}."`);
    return this._persistUser(request, pojoUser);
  }

  /**
   * Creates a new User object in Kuzzle's database layer and applies restricted profileIds
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  createRestrictedUser(request) {
    assertHasBody(request);
    assertIdStartsNotUnderscore(request);
    assertBodyHasAttribute(request, 'content');
    assertBodyAttributeType(request, 'content', 'object');
    assertContentHasNotAttribute(request, 'profileIds');

    if (request.input.body.credentials) {
      assertBodyAttributeType(request, 'credentials', 'object');
    }

    const pojoUser = request.input.body.content;
    pojoUser._id = request.input.resource._id || uuid();

    pojoUser.profileIds = this.kuzzle.config.security.restrictedProfileIds;

    this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" applied action "${request.input.action}" on user "${pojoUser._id}."`);
    return this._persistUser(request, pojoUser);
  }

  /**
   * Updates an existing User
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  updateUser(request) {
    assertHasBody(request);
    assertHasId(request);

    const options = {
      database: {
        method: 'update',
        refresh: getRefresh(request),
        retryOnConflict: request.input.args.retryOnConflict
      }
    };

    return this.kuzzle.repositories.user.load(request.input.resource._id)
      .then(user => this.updateMetadata(user, request))
      .then(user => {
        const pojo = request.input.body;
        pojo._id = request.input.resource._id;

        const currentUserPojo = this.kuzzle.repositories.user.toDTO(user);
        return this.kuzzle.repositories.user.fromDTO(
          Object.assign(currentUserPojo, pojo));
      })
      .then(user => this.kuzzle.repositories.user.persist(user, options))
      .then(updatedUser => {
        this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" applied action "${request.input.action}" on user "${updatedUser._id}."`);
        return formatProcessing.serializeUser(updatedUser);
      });
  }

  /**
   * Replaces an existing User
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async replaceUser (request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'profileIds');
    assertHasId(request);

    const user = request.input.body;
    user._id = request.input.resource._id;

    // Add metadata
    user._kuzzle_info = {
      author: this.getUserId(request),
      createdAt: Date.now(),
      updatedAt: null,
      updater: null
    };

    const options = {
      database: {
        method: 'replace',
        refresh: getRefresh(request)
      }
    };

    const loadedUser = await this.kuzzle.repositories.user.load(
      request.input.resource._id);

    if (!loadedUser) {
      throw errorsManager.get(
        'security',
        'user',
        'not_found',
        request.input.resource._id);
    }

    const
      updatedUser = await this.kuzzle.repositories.user.fromDTO(user),
      createdUser = await this.kuzzle.repositories.user.persist(
        updatedUser,
        options);

    this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" applied action "${request.input.action}" on user "${createdUser._id}."`);
    return formatProcessing.serializeUser(createdUser);
  }

  /**
   * Updates an existing profile
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  updateProfile(request) {
    assertHasBody(request);
    assertHasId(request);

    const options = {
      method: 'update',
      refresh: getRefresh(request),
      retryOnConflict: request.input.args.retryOnConflict
    };

    return this.kuzzle.repositories.profile.load(request.input.resource._id)
      .then(profile => this.updateMetadata(profile, request))
      .then(profile => this.kuzzle.repositories.profile.validateAndSaveProfile(
        _.extend(profile, request.input.body),
        options))
      .then(updatedProfile => {
        this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" applied action "${request.input.action}" on profile "${updatedProfile._id}."`);
        return formatProcessing.serializeProfile(updatedProfile);
      });
  }

  /**
   * Updates an existing role
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  updateRole(request) {
    assertHasBody(request);
    assertHasId(request);

    const options = {
      force: this.getBoolean(request, 'force'),
      method: 'update',
      refresh: getRefresh(request),
      retryOnConflict: request.input.args.retryOnConflict
    };

    return this.kuzzle.repositories.role.load(request.input.resource._id)
      .then(role => this.updateMetadata(role, request))
      .then(role => this.kuzzle.repositories.role.validateAndSaveRole(
        _.extend(role, request.input.body),
        options))
      .then(updatedRole => {
        this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" applied action "${request.input.action}" on role "${updatedRole._id}."`);
        return formatProcessing.serializeRole(updatedRole);
      });
  }

  /**
   * Creates the first admin user if it does not already exist
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  createFirstAdmin(request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'content');
    assertBodyAttributeType(request, 'content', 'object');
    assertIdStartsNotUnderscore(request);

    const reset = this.getBoolean(request, 'reset');

    return this.kuzzle.funnel.controllers.get('server').adminExists()
      .then(adminExists => {
        if (adminExists.exists) {
          return Bluebird.reject(new Error('Admin user is already set.'));
        }

        delete request.input.args.reset;
        request.input.body.content.profileIds = ['admin'];
        request.input.resource._id = request.input.resource._id || uuid();

        return this.createUser(request);
      })
      .then(response => {
        if (reset) {
          return resetRoles(
            this.kuzzle.config.security.standard.roles,
            this.kuzzle.repositories.role
          )
            .then(() => resetProfiles(this.kuzzle.repositories.profile))
            .then(() => this.kuzzle.internalIndex.refreshCollection('users'))
            .then(() => response);
        }

        this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" applied action "${request.input.action}".`);
        return response;
      });
  }

  /**
   * Deletes multiple profiles
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mDeleteProfiles(request) {
    return this.mDelete('profile', request);
  }

  /**
   * Deletes multiple roles
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mDeleteRoles(request) {
    return this.mDelete('role', request);
  }

  /**
   * Deletes multiple users
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mDeleteUsers(request) {
    return this.mDelete('user', request);
  }

  /**
   * Scroll a paginated users search result
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  scrollUsers(request) {
    assertHasScrollId(request);

    return this.kuzzle.repositories.user
      .scroll(request.input.args.scrollId, request.input.args.scroll)
      .then(response => {
        response.hits = response.hits.map(formatProcessing.serializeUser);
        return response;
      });
  }

  /**
   * Scroll a paginated profiles search result
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  scrollProfiles(request) {
    assertHasScrollId(request);

    return this.kuzzle.repositories.profile
      .scroll(request.input.args.scrollId, request.input.args.scroll)
      .then(response => {
        response.hits = response.hits.map(formatProcessing.serializeProfile);
        return response;
      });
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  createCredentials(request) {
    assertHasStrategy(request);
    assertIsStrategyRegistered(this.kuzzle, request);
    assertHasId(request);
    assertHasBody(request);

    const
      id = request.input.resource._id,
      strategy = request.input.args.strategy;

    return this.kuzzle.repositories.user.load(id)
      .then(user => {
        if (user === null) {
          throw errorsManager.get('security', 'user', 'not_found', id);
        }

        const validateMethod = this.kuzzle.pluginsManager.getStrategyMethod(
          strategy,
          'validate');

        return validateMethod(
          request,
          request.input.body,
          id,
          strategy,
          false);
      })
      .then(() => {
        const createMethod = this.kuzzle.pluginsManager.getStrategyMethod(
          strategy,
          'create');

        this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" applied action "${request.input.action}" on user "${id}."`);
        return createMethod(request, request.input.body, id, strategy);
      });
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  updateCredentials(request) {
    assertHasStrategy(request);
    assertIsStrategyRegistered(this.kuzzle, request);
    assertHasId(request);
    assertHasBody(request);

    const
      id = request.input.resource._id,
      strategy = request.input.args.strategy;

    return this.kuzzle.repositories.user.load(id)
      .then(user => {
        if (user === null) {
          throw errorsManager.get('security', 'user', 'not_found', id);
        }

        const validateMethod = this.kuzzle.pluginsManager.getStrategyMethod(
          strategy,
          'validate');

        return validateMethod(request, request.input.body, id, strategy, true);
      })
      .then(() => {
        const updateMethod = this.kuzzle.pluginsManager.getStrategyMethod(
          strategy,
          'update');

        this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" applied action "${request.input.action}" on user "${id}."`);
        return updateMethod(request, request.input.body, id, strategy);
      });
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  hasCredentials(request) {
    assertHasStrategy(request);
    assertIsStrategyRegistered(this.kuzzle, request);
    assertHasId(request);

    const existsMethod = this.kuzzle.pluginsManager.getStrategyMethod(
      request.input.args.strategy,
      'exists');

    return existsMethod(
      request,
      request.input.resource._id,
      request.input.args.strategy);
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  validateCredentials(request) {
    assertHasStrategy(request);
    assertIsStrategyRegistered(this.kuzzle, request);
    assertHasBody(request);

    const validateMethod = this.kuzzle.pluginsManager.getStrategyMethod(
      request.input.args.strategy,
      'validate');

    // _id can be null on purpose
    return validateMethod(
      request,
      request.input.body,
      request.input.resource._id,
      request.input.args.strategy,
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
    const action = _.upperFirst(type);

    assertHasBody(request);
    assertBodyHasAttribute(request, 'ids');
    assertBodyAttributeType(request, 'ids', 'array');

    if (request.input.body.ids.length > this.kuzzle.config.limits.documentsWriteCount) {
      throw errorsManager.get('services', 'storage', 'write_limit_exceeded');
    }

    const delRequests = await Bluebird.all(request.input.body.ids.map(id => {
      const deleteRequest = new Request({
        _id: id,
        action: `delete${action}`,
        controller: 'security'
      }, request.context);


      deleteRequest.input.args.refresh = getRefresh(request);

      return Bluebird.promisify(this.kuzzle.funnel.mExecute, {context: this.kuzzle.funnel})(deleteRequest);
    }));

    const
      errors = [],
      ids = [];

    delRequests.forEach(req => {
      if (req.error) {
        errors.push(req.error);
        return;
      }

      ids.push(req.input.resource._id);
    });

    if (errors.length) {
      request.setError(
        errorsManager.get('services', 'storage', 'incomplete_delete', errors));
    }

    if (ids.length > 1000) {
      this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" deleted the following ${type}s ${ids.slice(0, 1000).join(', ')}... (${ids.length - 1000} more users deleted)."`);
    }
    else {
      this.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" deleted the following ${type}s ${ids.join(', ')}."`);
    }
    return ids;
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
   * @param {{ _id: string, _kuzzle_info: object }} pojoUser
   * @returns {Promise<unknown>}
   * @private
   */
  async _persistUser(request, pojoUser) {
    let loadedUser;

    // Add metadata
    pojoUser._kuzzle_info = {
      author: request.context.user ? String(request.context.user._id) : null,
      createdAt: Date.now(),
      updatedAt: null,
      updater: null
    };

    try {
      loadedUser = await this.kuzzle.repositories.user.load(pojoUser._id);
    }
    catch (error) {
      if (error.id !== 'services.storage.not_found') {
        throw error;
      }
      loadedUser = null;
    }

    if (loadedUser !== null) {
      throw errorsManager.get('security', 'user', 'already_exists', pojoUser._id);
    }

    const strategies = request.input.body.credentials
      ? Object.keys(request.input.body.credentials)
      : [];

    // Early checks before the user is created
    for (const strategy of strategies) {
      if (!this.kuzzle.pluginsManager.listStrategies().includes(strategy)) {
        throw errorsManager.get('security', 'credentials', 'unknown_strategy', strategy);
      }

      if (
        await this.kuzzle.pluginsManager.getStrategyMethod(strategy, 'exists')(
          request,
          pojoUser._id,
          strategy
        )
      ) {
        throw errorsManager.get(
          'security',
          'credentials',
          'database_inconsistency',
          pojoUser._id);
      }
    }

    const options = {
      database: {
        method: 'create',
        refresh: getRefresh(request)
      }
    };

    // Throw in case of failure with the right KuzzleError object
    const createdUser = await this.kuzzle.repositories.user
      .fromDTO(pojoUser)
      .then(modifiedUser =>
        this.kuzzle.repositories.user.persist(modifiedUser, options)
      )
      .then(modifiedUser => formatProcessing.serializeUser(modifiedUser));

    // Creating credentials
    let creationFailure = null;

    for (const strategy of strategies) {
      try {
        await this.kuzzle.pluginsManager.getStrategyMethod(
          strategy,
          'validate'
        )(
          request,
          request.input.body.credentials[strategy],
          pojoUser._id,
          strategy,
          false
        );
      }
      catch (error) {
        creationFailure = {
          error,
          strategy,
          validation: true
        };
        break;
      }

      try {
        await this.kuzzle.pluginsManager.getStrategyMethod(strategy, 'create')(
          request,
          request.input.body.credentials[strategy],
          pojoUser._id,
          strategy
        );
      }
      catch (error) {
        creationFailure = {
          error,
          strategy
        };
        break;
      }
    }

    if (creationFailure === null) {
      return createdUser;
    }

    // Failed to create credentials: rollbacking
    // We try to delete the errored strategy as well
    let deletionError = null;
    try {
      const { strategy } = creationFailure;
      await this.kuzzle.pluginsManager.getStrategyMethod(strategy, 'delete')(
        request,
        pojoUser._id,
        strategy
      );
    }
    catch (e) {
      // We catch any error produced by delete as we want to make as much cleanup as possible
      deletionError = e;
    }

    return this.kuzzle.repositories.user
      .delete(pojoUser, { refresh: getRefresh(request) })
      .finally(() => {
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
      });
  }
}

module.exports = SecurityController;

/**
 * @param {RoleRepository} roleRepository
 * @param {Request} request
 * @param opts
 * @returns {Promise<Role>}
 */
function createOrReplaceRole (roleRepository, request, opts) {
  return roleRepository.getRoleFromRequest(request)
    .then(role => roleRepository.validateAndSaveRole(role, opts));
}

/**
 * @param {ProfileRepository} profileRepository
 * @param {Request} request
 * @param opts
 * @returns {Promise<Profile>}
 */
function createOrReplaceProfile (profileRepository, request, opts) {
  return profileRepository.getProfileFromRequest(request)
    .then(hydratedProfile => profileRepository.validateAndSaveProfile(
      hydratedProfile,
      opts));
}

/**
 * @param {object} defaults - Default roles configuration
 * @param {RoleRepository} roleRepository
 * @returns {Promise<*>}
 */
function resetRoles (defaults, roleRepository) {
  const promises = ['admin', 'default', 'anonymous'].map(id => {
    return roleRepository.fromDTO(Object.assign({_id: id}, defaults[id]))
      .then(role => roleRepository.validateAndSaveRole(role));
  });

  return Bluebird.all(promises);
}

/**
 * @param {ProfileRepository} profileRepository
 * @returns {Promise<*>}
 */
function resetProfiles (profileRepository) {
  const promises = ['admin', 'default', 'anonymous'].map(id => {
    return profileRepository.fromDTO({_id: id, policies: [{roleId: id}]})
      .then(profile => profileRepository.validateAndSaveProfile(profile));
  });

  return Bluebird.all(promises);
}

/**
 * Checks if a search result can exceeds the server configured limit
 * @param {Request} request
 * @param {number} limit
 * @throws
 */
function checkSearchPageLimit(request, limit) {
  if (request.input.args.size) {
    const size = request.input.args.size - (request.input.args.from || 0);

    if (size > limit) {
      throw errorsManager.get('services', 'storage', 'get_limit_exceeded');
    }
  }
}
