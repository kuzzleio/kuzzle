/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
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
  uuid = require('uuid/v4'),
  Bluebird = require('bluebird'),
  BaseController = require('./baseController'),
  formatProcessing = require('../core/auth/formatProcessing'),
  {
    Request,
    errors: {
      NotFoundError,
      BadRequestError,
      PluginImplementationError,
      PartialError,
      PreconditionError,
      InternalError: KuzzleInternalError,
      SizeLimitError
    }
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
 * @param {Kuzzle} kuzzle
 * @param {Request} request
 * @param {object} pojoUser
 */
const persistUser = Bluebird.coroutine(function* persistUserGenerator (kuzzle, request, pojoUser) {
  let loadedUser;

  try {
    loadedUser = yield kuzzle.repositories.user.load(pojoUser._id);
  }
  catch (error) {
    if (! (error instanceof NotFoundError)) {
      throw error;
    }
    loadedUser = null;
  }

  if (loadedUser !== null) {
    throw new PreconditionError(`user "${pojoUser._id}" already exist.`);
  }

  const
    strategies = request.input.body.credentials ? Object.keys(request.input.body.credentials) : [],
    registeredStrategies = kuzzle.pluginsManager.listStrategies();

  // Credentials validation
  for (const strategy of strategies) {
    if (registeredStrategies.indexOf(strategy) === -1) {
      throw new BadRequestError(`strategy "${strategy}" is not a known strategy.`);
    }

    const existMethod = kuzzle.pluginsManager.getStrategyMethod(strategy, 'exists');
    const exists = yield existMethod(request, pojoUser._id, strategy);

    if (exists === true) {
      throw new KuzzleInternalError(`Internal database inconsistency detected: existing credentials found on non-existing user ${pojoUser._id}`);
    }


    try {
      const validateMethod = kuzzle.pluginsManager.getStrategyMethod(strategy, 'validate');

      yield validateMethod(
        request,
        request.input.body.credentials[strategy],
        pojoUser._id,
        strategy,
        false
      );
    }
    catch (error) {
      if (! (error instanceof NotFoundError)) {
        throw new BadRequestError(error);
      }
    }
  }

  // Add metadata
  pojoUser._kuzzle_info = {
    author: request.context.user ? String(request.context.user._id) : null,
    createdAt: Date.now(),
    updatedAt: null,
    updater: null
  };

  const options = {
    database: {
      method: 'create',
      refresh: request.input.args.refresh
    }
  };
  // Throw in case of failure with the right KuzzleError object
  const createdUser = yield kuzzle.repositories.user.fromDTO(pojoUser)
    .then(modifiedUser => kuzzle.repositories.user.persist(modifiedUser, options))
    .then(modifiedUser => formatProcessing.formatUserForSerialization(kuzzle, modifiedUser));

  // Creating credentials
  const errors = [];
  let errorStep = null;

  for (let i = 0; i < strategies.length; i++) {
    const
      strategy = strategies[i],
      createMethod = kuzzle.pluginsManager.getStrategyMethod(strategy, 'create');

    try {
      yield createMethod(request, request.input.body.credentials[strategy], pojoUser._id, strategy);
    }
    catch (error) {
      errorStep = i;
      errors.push(error);
      break;
    }
  }

  if (errorStep === null) {
    return Bluebird.resolve(createdUser);
  }

  /*
    Failed to create credentials: rollbacking
    We try to delete the errored strategy as well
   */
  for (let i = 0; i <= errorStep; i++) {
    const
      strategy = strategies[i],
      deleteMethod = kuzzle.pluginsManager.getStrategyMethod(strategy, 'delete');

    // We catch any error produced by delete as we want to make as much cleanup as possible
    yield deleteMethod(request, pojoUser._id, strategy)
      .catch(error => {
        errors.push(error);
        return Bluebird.resolve();
      });
  }

  return kuzzle.repositories.user.delete(pojoUser._id, {refresh: request.input.args.refresh})
    .finally(() => {
      throw new PluginImplementationError(
        `An error occurred during the creation of user "${pojoUser._id}":\n`
        + errors.map(error => error.message).join('\n')
      );
    });
});

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 * @property {Kuzzle} kuzzle
 */
class SecurityController extends BaseController {
  constructor(kuzzle) {
    super(kuzzle, [
      'createCredentials',
      'createFirstAdmin',
      'createOrReplaceProfile',
      'createOrReplaceRole',
      'createProfile',
      'createRestrictedUser',
      'createRole',
      'createUser',
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
      'replaceUser',
      'revokeTokens',
      'scrollProfiles',
      'scrollUsers',
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
  }

  /**
   * Get the role mapping
   *
   * @returns {Promise}
   */
  getRoleMapping() {
    return this.kuzzle.internalEngine.getMapping({index: this.kuzzle.internalEngine.index, type: 'roles'})
      .then(response => ({mapping: response[this.kuzzle.internalEngine.index].mappings.roles.properties}));
  }

  /**
   * Update the roles collection mapping

   * @param {Request} request
   * @returns {Promise}
   */
  updateRoleMapping(request) {
    assertHasBody(request);
    return this.kuzzle.internalEngine.updateMapping('roles', request.input.body);
  }

  /**
   * Get the profile mapping
   *
   * @returns {Promise}
   */
  getProfileMapping() {
    return this.kuzzle.internalEngine.getMapping({index: this.kuzzle.internalEngine.index, type: 'profiles'})
      .then(response => ({mapping: response[this.kuzzle.internalEngine.index].mappings.profiles.properties}));
  }

  /**
   * Update the profiles collection mapping

   * @param {Request} request
   * @returns {Promise}
   */
  updateProfileMapping(request) {
    assertHasBody(request);
    return this.kuzzle.internalEngine.updateMapping('profiles', request.input.body);
  }

  /**
   * Get the user mapping
   *
   * @returns {Promise}
   */
  getUserMapping() {
    return this.kuzzle.internalEngine.getMapping({index: this.kuzzle.internalEngine.index, type: 'users'})
      .then(response => ({mapping: response[this.kuzzle.internalEngine.index].mappings.users.properties}));
  }

  /**
   * Update the users collection mapping

   * @param {Request} request
   * @returns {Promise}
   */
  updateUserMapping(request) {
    assertHasBody(request);
    return this.kuzzle.internalEngine.updateMapping('users', request.input.body);
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
          return Bluebird.reject(new NotFoundError(`Role with id ${request.input.resource._id} not found`));
        }

        return formatProcessing.formatRoleForSerialization(role);
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

    return this.kuzzle.repositories.role.loadMultiFromDatabase(request.input.body.ids)
      .then(roles => {
        const formatted = roles.map(role => formatProcessing.formatRoleForSerialization(role));
        return {hits: formatted, total: formatted.length};
      });
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
      from = request.input.args && request.input.args.from && Number(request.input.args.from),
      size = request.input.args && request.input.args.size && Number(request.input.args.size);

    return this.kuzzle.repositories.role.searchRole(controllers, from, size)
      .then(response => {
        response.hits = response.hits.map((role => formatProcessing.formatRoleForSerialization(role)));

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

    return createOrReplaceRole(this.kuzzle.repositories.role, request, {method: 'createOrReplace', refresh: request.input.args.refresh})
      .then(role => formatProcessing.formatRoleForSerialization(role));
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

    return createOrReplaceRole(this.kuzzle.repositories.role, request, {method: 'create', refresh: request.input.args.refresh})
      .then(role => formatProcessing.formatRoleForSerialization(role));
  }

  /**
   * Remove a role according to the given id
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  deleteRole(request) {
    assertHasId(request);

    const options = { refresh: request.input.args.refresh };

    return this.kuzzle.repositories.role.load(request.input.resource._id)
      .then(role => this.kuzzle.repositories.role.delete(role, options));
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
          return Bluebird.reject(new NotFoundError(`Profile with id ${request.input.resource._id} not found`));
        }

        return formatProcessing.formatProfileForSerialization(profile);
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

    return this.kuzzle.repositories.profile.loadMultiFromDatabase(request.input.body.ids)
      .then(profiles => {
        const formatted = profiles.map(profile => formatProcessing.formatProfileForSerialization(profile));
        return {hits: formatted, total: formatted.length};
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

    return createOrReplaceProfile(this.kuzzle.repositories.profile, request, {method: 'createOrReplace', refresh: request.input.args.refresh})
      .then(profile => formatProcessing.formatProfileForSerialization(profile));
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

    return createOrReplaceProfile(this.kuzzle.repositories.profile, request, {method: 'create', refresh: request.input.args.refresh})
      .then(profile => formatProcessing.formatProfileForSerialization(profile));
  }

  /**
   * Deletes a profile
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  deleteProfile(request) {
    assertHasId(request);

    const options = { refresh: request.input.args.refresh };

    return this.kuzzle.repositories.profile.load(request.input.resource._id)
      .then(profile => this.kuzzle.repositories.profile.delete(profile, options));
  }

  /**
   * Returns a list of profiles that contain a given set of roles
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  searchProfiles(request) {
    let roles = [];

    checkSearchPageLimit(request, this.kuzzle.config.limits.documentsFetchCount);

    if (request.input.body && request.input.body.roles) {
      roles = request.input.body.roles;
    }

    return this.kuzzle.repositories.profile.searchProfiles(roles, request.input.args)
      .then(response => {
        response.hits = response.hits.map(profile => formatProcessing.formatProfileForSerialization(profile));
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
          return Bluebird.reject(new NotFoundError(`User with id ${request.input.resource._id} not found`));
        }

        return formatProcessing.formatUserForSerialization(this.kuzzle, user);
      });
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
          return Bluebird.reject(new NotFoundError(`Profile with id ${request.input.resource._id} not found`));
        }

        return profile.getRights();
      })
      .then(rights => Object.keys(rights).reduce((array, item) => array.concat(rights[item]), []))
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
          throw new NotFoundError(`User with id ${request.input.resource._id} not found`);
        }

        return user.getRights(this.kuzzle);
      })
      .then(rights => Object.keys(rights).reduce((array, item) => array.concat(rights[item]), []))
      .then(rights => ({hits: rights, total: rights.length}));
  }

  /**
   * Returns the User objects matching the given query
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  searchUsers(request) {
    checkSearchPageLimit(request, this.kuzzle.config.limits.documentsFetchCount);

    return this.kuzzle.repositories.user.search(
      request.input.body ? request.input.body : {},
      request.input.args
    ).then(response => formatUserSearchResult(this.kuzzle, formatProcessing.formatUserForSerialization, response));
  }

  /**
   * Deletes a User from Kuzzle
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  deleteUser(request) {
    assertHasId(request);

    const options = { refresh: request.input.args.refresh };

    return this.kuzzle.repositories.user.load(request.input.resource._id)
      .then(user => this.kuzzle.repositories.user.delete(user, options));
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

    return persistUser(this.kuzzle, request, pojoUser);
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

    return persistUser(this.kuzzle, request, pojoUser);
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
        refresh: request.input.args.refresh,
        retryOnConflict: request.input.args.retryOnConflict
      }
    };

    return this.kuzzle.repositories.user.load(request.input.resource._id)
      .then(user => updateMetadata(user, request))
      .then(user => {
        const pojo = request.input.body;
        pojo._id = request.input.resource._id;

        const currentUserPojo = this.kuzzle.repositories.user.toDTO(user);
        return this.kuzzle.repositories.user.fromDTO(Object.assign(currentUserPojo, pojo));
      })
      .then(user => this.kuzzle.repositories.user.persist(user, options))
      .then(updatedUser => formatProcessing.formatUserForSerialization(this.kuzzle, updatedUser));
  }

  /**
   * Replaces an existing User
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  replaceUser(request) {
    let pojoUser;

    assertHasBody(request);
    assertBodyHasAttribute(request, 'profileIds');
    assertHasId(request);

    pojoUser = request.input.body;
    pojoUser._id = request.input.resource._id;

    // Add metadata
    pojoUser._kuzzle_info = {
      author: request.context.user ? String(request.context.user._id) : null,
      createdAt: Date.now(),
      updatedAt: null,
      updater: null
    };

    const options = {
      database: {
        method: 'replace',
        refresh: request.input.args.refresh
      }
    };

    return this.kuzzle.repositories.user.load(request.input.resource._id)
      .then(loadedUser => (!loadedUser) ? Bluebird.reject(new NotFoundError(`User with id ${request.input.resource._id} not found`)) : Bluebird.resolve())
      .then(() => this.kuzzle.repositories.user.fromDTO(pojoUser))
      .then(updatedUser => this.kuzzle.repositories.user.persist(updatedUser, options))
      .then(createdUser => formatProcessing.formatUserForSerialization(this.kuzzle, createdUser));
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
      refresh: request.input.args.refresh,
      retryOnConflict: request.input.args.retryOnConflict
    };

    return this.kuzzle.repositories.profile.load(request.input.resource._id)
      .then(profile => updateMetadata(profile, request))
      .then(profile => this.kuzzle.repositories.profile.validateAndSaveProfile(_.extend(profile, request.input.body), options))
      .then(updatedProfile => formatProcessing.formatProfileForSerialization(updatedProfile));
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
      method: 'update',
      refresh: request.input.args.refresh,
      retryOnConflict: request.input.args.retryOnConflict
    };

    return this.kuzzle.repositories.role.load(request.input.resource._id)
      .then(role => updateMetadata(role, request))
      .then(role => this.kuzzle.repositories.role.validateAndSaveRole(_.extend(role, request.input.body), options))
      .then(updatedRole => formatProcessing.formatRoleForSerialization(updatedRole));
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

    const reset = request.input.args.reset || false;

    return this.kuzzle.funnel.controllers.server.adminExists()
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
          return resetRoles(this.kuzzle.config.security.standard.roles, this.kuzzle.repositories.role)
            .then(() => resetProfiles(this.kuzzle.repositories.profile))
            .then(() => this.kuzzle.funnel.controllers.index.refreshInternal())
            .then(() => response);
        }

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
    return mDelete(this.kuzzle, 'profile', request);
  }

  /**
   * Deletes multiple roles
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mDeleteRoles(request) {
    return mDelete(this.kuzzle, 'role', request);
  }

  /**
   * Deletes multiple users
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  mDeleteUsers(request) {
    return mDelete(this.kuzzle, 'user', request);
  }

  /**
   * Scroll a paginated users search result
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  scrollUsers(request) {
    assertHasScrollId(request);

    return this.kuzzle.repositories.user.scroll(request.input.args.scrollId, request.input.args.scroll)
      .then(response => formatUserSearchResult(this.kuzzle, formatProcessing.formatUserForSerialization, response));
  }

  /**
   * Scroll a paginated profiles search result
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  scrollProfiles(request) {
    assertHasScrollId(request);

    return this.kuzzle.repositories.profile.scroll(request.input.args.scrollId, request.input.args.scroll)
      .then(response => {
        response.hits = response.hits.map(profile => formatProcessing.formatProfileForSerialization(profile));
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
          throw new BadRequestError(`Cannot create credentials: unknown kuid "${id}"`);
        }

        const validateMethod = this.kuzzle.pluginsManager.getStrategyMethod(strategy, 'validate');

        return validateMethod(request, request.input.body, id, strategy, false);
      })
      .then(() => {
        const createMethod = this.kuzzle.pluginsManager.getStrategyMethod(strategy, 'create');

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
          throw new BadRequestError(`Cannot update credentials: unknown kuid "${id}"`);
        }

        const validateMethod = this.kuzzle.pluginsManager.getStrategyMethod(strategy, 'validate');

        return validateMethod(request, request.input.body, id, strategy, true);
      })
      .then(() => {
        const updateMethod = this.kuzzle.pluginsManager.getStrategyMethod(strategy, 'update');

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

    const existsMethod = this.kuzzle.pluginsManager.getStrategyMethod(request.input.args.strategy, 'exists');

    return existsMethod(request, request.input.resource._id, request.input.args.strategy);
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  validateCredentials(request) {
    assertHasStrategy(request);
    assertIsStrategyRegistered(this.kuzzle, request);
    assertHasBody(request);

    const validateMethod = this.kuzzle.pluginsManager.getStrategyMethod(request.input.args.strategy, 'validate');

    // _id can be null on purpose
    return validateMethod(request, request.input.body, request.input.resource._id, request.input.args.strategy, false);
  }

  /**
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  deleteCredentials(request) {
    assertHasStrategy(request);
    assertIsStrategyRegistered(this.kuzzle, request);
    assertHasId(request);

    const deleteMethod = this.kuzzle.pluginsManager.getStrategyMethod(request.input.args.strategy, 'delete');

    return deleteMethod(request, request.input.resource._id, request.input.args.strategy)
      .then(() => ({acknowledged: true}));
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
      const getInfoMethod = this.kuzzle.pluginsManager.getStrategyMethod(request.input.args.strategy, 'getInfo');

      return getInfoMethod(request, request.input.resource._id, request.input.args.strategy);
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
      const getByIdMethod = this.kuzzle.pluginsManager.getStrategyMethod(request.input.args.strategy, 'getById');

      return getByIdMethod(request, request.input.resource._id, request.input.args.strategy);
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

    return Bluebird.resolve(this.kuzzle.pluginsManager.getStrategyFields(request.input.args.strategy));
  }

  /**
   * @returns {Promise<Object>}
   */
  getAllCredentialFields() {
    const strategyFields = {};

    this.kuzzle.pluginsManager.listStrategies().forEach(strategy => {
      strategyFields[strategy] = this.kuzzle.pluginsManager.getStrategyFields(strategy);
    });

    return Bluebird.resolve(strategyFields);
  }

  revokeTokens(request) {
    assertHasId(request);

    const userId = request.input.resource._id;
    return this.kuzzle.repositories.user.load(userId)
      .then(user => {
        if (!user) {
          return Bluebird.reject(new NotFoundError(`User with id ${userId} not found`));
        }
        
        this.kuzzle.repositories.token.deleteByUserId(userId);
        return Bluebird.resolve();
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
    .then(hydratedProfile => profileRepository.validateAndSaveProfile(hydratedProfile, opts));
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
 *
 * @param {Kuzzle} kuzzle
 * @param {string.<profile|role|user>} type
 * @param {Request} request
 * @returns {Promise<*>}
 */
function mDelete (kuzzle, type, request) {
  const action = _.upperFirst(type);

  assertHasBody(request);
  assertBodyHasAttribute(request, 'ids');
  assertBodyAttributeType(request, 'ids', 'array');

  if (request.input.body.ids.length > kuzzle.config.limits.documentsWriteCount) {
    throw new BadRequestError(`Number of delete to perform exceeds the server configured value (${kuzzle.config.limits.documentsWriteCount})`);
  }

  return Bluebird.all(request.input.body.ids.map(id => {
    const deleteRequest = new Request({
      controller: 'security',
      action: `delete${action}`,
      _id: id
    }, request.context);


    if (request.input.args.refresh) {
      deleteRequest.input.args.refresh = request.input.args.refresh;
    }

    return Bluebird.promisify(kuzzle.funnel.mExecute, {context: kuzzle.funnel})(deleteRequest);
  }))
    .then(delRequests => {
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
        request.setError(new PartialError(`security:mDelete${action}s Error(s) deleting ${type} items`, errors));
      }

      return ids;
    });
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
      throw new SizeLimitError(`Search page size exceeds server configured documents limit (${limit})`);
    }
  }
}

/**
 * Normalizes search results
 * @param {Kuzzle} kuzzle
 * @param {function} formatter
 * @param {object} raw
 * @returns {Promise<object>}
 */
function formatUserSearchResult(kuzzle, formatter, raw) {
  return Bluebird.map(raw.hits, user => formatter(kuzzle, user))
    .then(formattedUsers => {
      raw.hits = formattedUsers;
      return raw;
    });
}

/**
 * Sets the metadata for an update request
 * @param {object} securityDocument
 * @param {Request} request
 * @returns {object}
 */
function updateMetadata(securityDocument, request) {
  if (!securityDocument) {
    return Bluebird.reject(
      new NotFoundError(`Cannot update non-existing ${request.input.action.replace('update', '').toLowerCase()} "${request.input.resource._id}"`)
    );
  }

  securityDocument._kuzzle_info = _.assign(securityDocument._kuzzle_info, {
    updatedAt: Date.now(),
    updater: request.context.user ? String(request.context.user._id) : null
  });

  return securityDocument;
}
