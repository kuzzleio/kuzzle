/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2017 Kuzzle
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
  uuid = require('node-uuid'),
  Bluebird = require('bluebird'),
  formatProcessing = require('../core/auth/formatProcessing'),
  Request = require('kuzzle-common-objects').Request,
  User = require('../core/models/security/user'),
  Role = require('../core/models/security/role'),
  Profile = require('../core/models/security/profile'),
  {
    NotFoundError,
    BadRequestError,
    PartialError,
    InternalError,
    SizeLimitError
  } = require('kuzzle-common-objects').errors,
  {
    assertHasBody,
    assertBodyHasAttribute,
    assertBodyAttributeType,
    assertHasId,
    assertIdStartsNotUnderscore,
    assertHasStrategy,
    assertHasScrollId,
    assertIsStrategyRegistered
  } = require('../../util/requestAssertions'),
  getRequestRoute = require('../../util/string').getRequestRoute;

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 * @property {Kuzzle} kuzzle
 */
class SecurityController {
  constructor(kuzzle) {
    /** @type Kuzzle */
    this.kuzzle = kuzzle;
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

    return this.kuzzle.repositories.role.loadRole(request.input.resource._id)
      .then(role => {
        if (!role) {
          return Bluebird.reject(new NotFoundError(`${getRequestRoute(request)} Role with id ${request.input.resource._id} not found`));
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

    return createOrReplaceRole(this.kuzzle.repositories.role, request, {method: 'createOrReplace'})
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

    return createOrReplaceRole(this.kuzzle.repositories.role, request, {method: 'create'})
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

    const role = this.kuzzle.repositories.role.getRoleFromRequest(request);

    return this.kuzzle.repositories.role.deleteRole(role, request.input.args.refresh);
  }

  /**
   * Get a specific profile according to the given id
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  getProfile(request) {
    assertHasId(request);

    return this.kuzzle.repositories.profile.loadProfile(request.input.resource._id)
      .then(profile => {
        if (!profile) {
          return Bluebird.reject(new NotFoundError(`${getRequestRoute(request)} Profile with id ${request.input.resource._id} not found`));
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

    return createOrReplaceProfile(this.kuzzle.repositories.profile, request, {method: 'createOrReplace'})
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

    return createOrReplaceProfile(this.kuzzle.repositories.profile, request, {method: 'create'})
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

    return this.kuzzle.repositories.profile.buildProfileFromRequest(request)
      .then(profile => this.kuzzle.repositories.profile.deleteProfile(profile, request.input.args.refresh));
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
          return Bluebird.reject(new NotFoundError(`${getRequestRoute(request)} User with id ${request.input.resource._id} not found`));
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

    return this.kuzzle.repositories.profile.loadProfile(request.input.resource._id)
      .then(profile => {
        if (!profile) {
          return Bluebird.reject(new NotFoundError(`${getRequestRoute(request)} Profile with id ${request.input.resource._id} not found`));
        }

        return profile.getRights(this.kuzzle);
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
          throw new NotFoundError(`${getRequestRoute(request)} User with id ${request.input.resource._id} not found`);
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
      request.input.body && request.input.body.query ? request.input.body.query : {},
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
    const kuzzle = this.kuzzle;

    assertHasId(request);

    return this.kuzzle.repositories.user.delete(request.input.resource._id, {refresh: request.input.args.refresh})
      .then(() => this.kuzzle.repositories.token.deleteByUserId(request.input.resource._id))
      .then(Bluebird.coroutine(function* securityDeleteUserGenerator () {
        let
          availableStrategies = kuzzle.pluginsManager.listStrategies(),
          userStrategies = [];

        for (let i = 0; i < availableStrategies.length; i++) {
          const
            strategy = availableStrategies[i],
            existsMethod = kuzzle.pluginsManager.getStrategyMethod(request, strategy, 'exists'),
            existStrategy = yield existsMethod(request, request.input.resource._id);

          if (existStrategy) {
            userStrategies.push(strategy);
          }
        }

        if (userStrategies.length > 0) {
          for (let i = 0; i < userStrategies.length; i++) {
            const
              strategy = userStrategies[i],
              deleteMethod = kuzzle.pluginsManager.getStrategyMethod(request, strategy, 'delete');

            // We catch any error produced by delete as we want to make as much cleanup as possible
            yield deleteMethod(request, request.input.resource._id)
              .catch(() => {
                kuzzle.pluginsManager.trigger('log:error', `${getRequestRoute(request)} was not able to remove credentials of user "${request.input.resource._id}" for strategy ${strategy}.`);
                return Promise.resolve();
              });

          }
        }
      }))
      .then(() => ({ _id: request.input.resource._id}));
  }

  /**
   * Creates a new User object in Kuzzle's database layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  createUser(request) {
    return createUser(this.kuzzle, request, false);
  }

  /**
   * Creates a new User object in Kuzzle's database layer and applies restricted profileIds
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  createRestrictedUser(request) {
    return createUser(this.kuzzle, request, true);
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

    return this.kuzzle.repositories.user.load(request.input.resource._id)
      .then(user => this.kuzzle.repositories.user.persist(_.extend(user, request.input.body), {database: {method: 'update'}}))
      .then(updatedUser => formatProcessing.formatUserForSerialization(this.kuzzle, updatedUser));
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

    return this.kuzzle.repositories.profile.loadProfile(request.input.resource._id)
      .then(profile => this.kuzzle.repositories.profile.validateAndSaveProfile(_.extend(profile, request.input.body), {method: 'update'}))
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

    return this.kuzzle.repositories.role.loadRole(request.input.resource._id)
      .then(role => {
        if (!role) {
          return Bluebird.reject(new NotFoundError(`${getRequestRoute(request)} Cannot update role ${request.input.resource._id}: role not found`));
        }

        return this.kuzzle.repositories.role.validateAndSaveRole(_.extend(role, request.input.body), {method: 'update'});
      })
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
          return Bluebird.reject(new Error(`${getRequestRoute(request)} admin user is already set`));
        }

        delete request.input.args.reset;
        request.input.body.content.profileIds = ['admin'];
        request.input.resource._id = request.input.resource._id || uuid.v4();

        return this.kuzzle.funnel.controllers.security.createUser(request);
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
   * @returns {Promise.<Object>}
   */
  mDeleteProfiles(request) {
    return mDelete(this.kuzzle, 'profile', request);
  }

  /**
   * Deletes multiple roles
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  mDeleteRoles(request) {
    return mDelete(this.kuzzle, 'role', request);
  }

  /**
   * Deletes multiple users
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  mDeleteUsers(request) {
    return mDelete(this.kuzzle, 'user', request);
  }

  /**
   * Scroll a paginated users search result
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
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
   * @returns {Promise.<Object>}
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
   * @returns {Promise.<Object>}
   */
  createCredentials(request) {
    let
      createMethod,
      validateMethod;

    assertHasStrategy(request);
    assertIsStrategyRegistered(this.kuzzle, request);
    assertHasId(request);
    assertHasBody(request);

    createMethod = this.kuzzle.pluginsManager.getStrategyMethod(request, request.input.args.strategy, 'create');
    validateMethod = this.kuzzle.pluginsManager.getStrategyMethod(request, request.input.args.strategy, 'validate');

    return validateMethod(request, request.input.body, request.input.resource._id)
      .then(() => createMethod(request, request.input.body, request.input.resource._id));
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  updateCredentials(request) {
    let
      updateMethod,
      validateMethod;

    assertHasStrategy(request);
    assertIsStrategyRegistered(this.kuzzle, request);
    assertHasId(request);
    assertHasBody(request);

    updateMethod = this.kuzzle.pluginsManager.getStrategyMethod(request, request.input.args.strategy, 'update');
    validateMethod = this.kuzzle.pluginsManager.getStrategyMethod(request, request.input.args.strategy, 'validate');

    return validateMethod(request, request.input.body, request.input.resource._id)
      .then(() => updateMethod(request, request.input.body, request.input.resource._id));
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  hasCredentials(request) {
    let existsMethod;

    assertHasStrategy(request);
    assertIsStrategyRegistered(this.kuzzle, request);
    assertHasId(request);

    existsMethod = this.kuzzle.pluginsManager.getStrategyMethod(request, request.input.args.strategy, 'exists');

    return existsMethod(request, request.input.resource._id);
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  validateCredentials(request) {
    let validateMethod;

    assertHasStrategy(request);
    assertIsStrategyRegistered(this.kuzzle, request);
    assertHasBody(request);

    validateMethod = this.kuzzle.pluginsManager.getStrategyMethod(request, request.input.args.strategy, 'validate');

    // _id can be null on purpose
    return validateMethod(request, request.input.body, request.input.resource._id);
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  deleteCredentials(request) {
    let deleteMethod;

    assertHasStrategy(request);
    assertIsStrategyRegistered(this.kuzzle, request);
    assertHasId(request);

    deleteMethod = this.kuzzle.pluginsManager.getStrategyMethod(request, request.input.args.strategy, 'delete');

    return deleteMethod(request, request.input.resource._id);
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  getCredentials(request) {
    let getInfoMethod;

    assertHasStrategy(request);
    assertIsStrategyRegistered(this.kuzzle, request);
    assertHasId(request);

    if (this.kuzzle.pluginsManager.hasStrategyMethod(request.input.args.strategy, 'getInfo')) {
      getInfoMethod = this.kuzzle.pluginsManager.getStrategyMethod(request, request.input.args.strategy, 'getInfo');

      return getInfoMethod(request, request.input.resource._id);
    }

    return Promise.resolve({});
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  getCredentialFields(request) {
    assertHasStrategy(request);
    assertIsStrategyRegistered(this.kuzzle, request);

    return Promise.resolve(this.kuzzle.pluginsManager.getStrategyFields(request.input.args.strategy));
  }

  /**
   * @returns {Promise.<Object>}
   */
  getAllCredentialFields() {
    const strategyFields = {};

    this.kuzzle.pluginsManager.listStrategies().forEach(strategy => {
      strategyFields[strategy] = this.kuzzle.pluginsManager.getStrategyFields(strategy);
    });

    return Promise.resolve(strategyFields);
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
  const role = roleRepository.getRoleFromRequest(request);

  return roleRepository.validateAndSaveRole(role, opts);
}

/**
 * @param {ProfileRepository} profileRepository
 * @param {Request} request
 * @param opts
 * @returns {Promise<Profile>}
 */
function createOrReplaceProfile (profileRepository, request, opts) {
  return profileRepository.buildProfileFromRequest(request)
    .then(profile => profileRepository.hydrate(profile, request.input.body))
    .then(hydratedProfile => profileRepository.validateAndSaveProfile(hydratedProfile, opts));
}

/**
 * @param {object} defaults - Default roles configuration
 * @param {RoleRepository} roleRepository
 * @returns {Promise.<*>}
 */
function resetRoles (defaults, roleRepository) {
  const promises = ['admin', 'default', 'anonymous'].map(id => {
    const role = Object.assign(new Role(), {_id: id}, defaults[id]);
    return roleRepository.validateAndSaveRole(role);
  });

  return Bluebird.all(promises);
}

/**
 * @param {ProfileRepository} profileRepository
 * @returns {Promise.<*>}
 */
function resetProfiles (profileRepository) {
  const promises = ['admin', 'default', 'anonymous'].map(id => {
    const profile = Object.assign(new Profile(), {_id: id, policies: [{roleId: id}]});
    return profileRepository.validateAndSaveProfile(profile);
  });

  return Bluebird.all(promises);
}

/**
 *
 * @param {Kuzzle} kuzzle
 * @param {string.<profile|role|user>} type
 * @param {Request} request
 * @returns {Promise.<*>}
 */
function mDelete (kuzzle, type, request) {
  const action = _.upperFirst(type);

  assertHasBody(request);
  assertBodyHasAttribute(request, 'ids');
  assertBodyAttributeType(request, 'ids', 'array');

  if (request.input.body.ids.length > kuzzle.config.limits.documentsWriteCount) {
    throw new BadRequestError(`${getRequestRoute(request)} Number of delete to perform exceeds the server configured value (${kuzzle.config.limits.documentsWriteCount})`);
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

    return new Bluebird(resolve => {
      kuzzle.funnel.getRequestSlot(deleteRequest, overloadError => {
        if (overloadError) {
          deleteRequest.setError(overloadError);
          return resolve(deleteRequest);
        }

        kuzzle.funnel.processRequest(deleteRequest)
          .catch(error => deleteRequest.setError(error))
          .finally(() => resolve(deleteRequest));
      });
    });
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
      throw new SizeLimitError(`${getRequestRoute(request)} Search page size exceeds server configured documents limit (${limit})`);
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
  const
    promises = raw.hits.map(user => formatter(kuzzle, user)),
    users = raw;

  return Bluebird.all(promises)
    .then(formattedUsers => {
      users.hits = formattedUsers;
      return users;
    });
}


/**
 * Creates a new User object in Kuzzle's database layer
 *
 * @param {Kuzzle} kuzzle
 * @param {Request} request
 * @param {boolean} restricted
 * @returns {Promise<Object>}
 */
function createUser (kuzzle, request, restricted) {
  let pojoUser;

  assertHasBody(request);
  assertIdStartsNotUnderscore(request);
  assertBodyHasAttribute(request, 'content');
  assertBodyAttributeType(request, 'content', 'object');

  if (request.input.body.credentials) {
    assertBodyAttributeType(request, 'credentials', 'object');
  }

  if (restricted) {
    if (request.input.body.content.profileIds) {
      throw new BadRequestError(`${getRequestRoute(request)} must not specify the body attribute "content.profileIds".`);
    }
  }
  else {
    if (!request.input.body.content.profileIds) {
      throw new BadRequestError(`${getRequestRoute(request)} must specify a body attribute "content.profileIds".`);
    }
    if (!Array.isArray(request.input.body.content.profileIds)) {
      throw new BadRequestError(`${getRequestRoute(request)} must specify the body attribute "content.profileIds" of type "array".`);
    }
  }

  pojoUser = request.input.body.content;
  pojoUser._id = request.input.resource._id || uuid.v4();

  if (restricted) {
    pojoUser.profileIds = kuzzle.config.security.restrictedProfileIds;
  }

  return Bluebird.coroutine(persistUserAndStrategies)(kuzzle, request, pojoUser);
}

/**
 * @param {Kuzzle} kuzzle
 * @param {Request} request
 * @param {object} pojoUser
 */
function* persistUserAndStrategies (kuzzle, request, pojoUser) {
  const
    user = new User(),
    loadedUser = yield Bluebird.resolve(kuzzle.repositories.user.load(pojoUser._id));
  let
    strategies = [],
    errorStep = -1,
    creationError,
    createdUser;

  if (loadedUser !== null && loadedUser._id !== kuzzle.repositories.user.anonymous()._id) {
    throw new BadRequestError(`${getRequestRoute(request)} user "${pojoUser._id}" already exist.`);
  }

  if (request.input.body.credentials && Object.keys(request.input.body.credentials).length > 0) {
    strategies = Object.keys(request.input.body.credentials);

    for (let i = 0; i < strategies.length; i++) {
      if (kuzzle.pluginsManager.listStrategies().indexOf(strategies[i]) === -1) {
        throw new BadRequestError(`${getRequestRoute(request)} strategy "${strategies[i]}" is not a known strategy.`);
      }
    }


    for (let i = 0; i < strategies.length; i++) {
      const
        strategy = strategies[i],
        validateMethod = kuzzle.pluginsManager.getStrategyMethod(request, strategy, 'validate'),
        validateResult = yield validateMethod(request, request.input.body.credentials[strategy], pojoUser._id);

      if (!validateResult) {
        throw new BadRequestError(`${getRequestRoute(request)} credentials for strategy "${strategy}" are not valid.`);
      }
    }

    for (let i = 0; i < strategies.length; i++) {
      const
        strategy = strategies[i],
        createMethod = kuzzle.pluginsManager.getStrategyMethod(request, strategy, 'create');

      try {
        yield createMethod(request, request.input.body.credentials[strategy], pojoUser._id);
      }
      catch (error) {
        errorStep = i;
        creationError = error;
        break;
      }
    }
  }

  if (errorStep === -1) {
    try {
      createdUser = yield kuzzle.repositories.user.hydrate(user, pojoUser)
        .then(modifiedUser => kuzzle.repositories.user.persist(modifiedUser, {database: {method: 'create'}}))
        .then(modifiedUser => formatProcessing.formatUserForSerialization(kuzzle, modifiedUser));
    }
    catch (error) {
      errorStep = strategies.length - 1;
      creationError = error;
    }
  }

  if (errorStep === -1) {
    return Bluebird.resolve(createdUser);
  }

  for (let i = 0; i < errorStep; i++) {
    const
      strategy = strategies[i],
      deleteMethod = kuzzle.pluginsManager.getStrategyMethod(request, strategy, 'delete');

    // We catch any error produced by delete as we want to make as much cleanup as possible
    yield deleteMethod(request, request.input.body.credentials[strategy], pojoUser._id)
      .catch(() => {
        kuzzle.pluginsManager.trigger('log:error', `${getRequestRoute(request)} was not able to remove bad credentials of user "${request.input.resource._id}" for strategy ${strategy}.`);
        return Bluebird.resolve();
      });
  }

  throw new InternalError(creationError);
}