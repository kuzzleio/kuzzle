/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
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

const _ = require('lodash'),
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
    SizeLimitError
  } = require('kuzzle-common-objects').errors,
  {
    assertHasBody,
    assertBodyHasAttribute,
    assertBodyHasNotAttribute,
    assertBodyAttributeType,
    assertHasId,
    assertIdStartsNotUnderscore
  } = require('./util/requestAssertions');

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

    return this.kuzzle.repositories.profile.loadProfile(request.input.resource._id)
      .then(profile => {
        if (!profile) {
          return Bluebird.reject(new NotFoundError(`Profile with id ${request.input.resource._id} not found`));
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
    assertHasId(request);

    return this.kuzzle.repositories.user.delete(request.input.resource._id, {refresh: request.input.args.refresh})
      .then(() => this.kuzzle.repositories.token.deleteByUserId(request.input.resource._id))
      .then(() => ({ _id: request.input.resource._id}));
  }

  /**
   * Creates a new User object in Kuzzle's database layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  createUser(request) {
    const user = new User();
    let pojoUser;

    assertHasBody(request);
    assertBodyHasAttribute(request, 'profileIds');
    assertBodyAttributeType(request, 'profileIds', 'array');
    assertIdStartsNotUnderscore(request);

    pojoUser = request.input.body;
    pojoUser._id = request.input.resource._id || uuid.v4();

    return this.kuzzle.repositories.user.hydrate(user, pojoUser)
      .then(modifiedUser => this.kuzzle.repositories.user.persist(modifiedUser, { database: {method: 'create'} }))
      .then(modifiedUser => formatProcessing.formatUserForSerialization(this.kuzzle, modifiedUser));
  }

  /**
   * Creates a new User object in Kuzzle's database layer and applies restricted profileIds
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  createRestrictedUser(request) {
    assertHasBody(request);
    assertBodyHasNotAttribute(request, 'profileIds');
    assertIdStartsNotUnderscore(request);

    const pojoUser = request.input.body;
    pojoUser._id = request.input.resource._id || uuid.v4();
    pojoUser.profileIds = this.kuzzle.config.security.restrictedProfileIds;

    const user = new User();

    return this.kuzzle.repositories.user.hydrate(user, pojoUser)
      .then(modifiedUser => this.kuzzle.repositories.user.persist(modifiedUser, {database: {method: 'create'}}))
      .then(modifiedUser => formatProcessing.formatUserForSerialization(this.kuzzle, modifiedUser));
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
          return Bluebird.reject(new NotFoundError(`Cannot update role ${request.input.resource._id}: role not found`));
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
    assertIdStartsNotUnderscore(request);

    const reset = request.input.args.reset || false;

    return this.kuzzle.funnel.controllers.server.adminExists()
      .then(adminExists => {
        if (adminExists.exists) {
          return Bluebird.reject(new Error('admin user is already set'));
        }

        delete request.input.args.reset;
        request.input.body.profileIds = ['admin'];
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
    if (!request.input.args.scrollId) {
      throw new BadRequestError('Missing "scrollId" argument');
    }

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
    if (!request.input.args.scrollId) {
      throw new BadRequestError('Missing "scrollId" argument');
    }

    return this.kuzzle.repositories.profile.scroll(request.input.args.scrollId, request.input.args.scroll)
      .then(response => {
        response.hits = response.hits.map(profile => formatProcessing.formatProfileForSerialization(profile));
        return response;
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
        request.setError(new PartialError(`security:${action}. Error(s) deleting ${type} items`, errors));
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
  const
    promises = raw.hits.map(user => formatter(kuzzle, user)),
    users = raw;

  return Bluebird.all(promises)
    .then(formattedUsers => {
      users.hits = formattedUsers;
      return users;
    });
}
