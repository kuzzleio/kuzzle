'use strict';

const _ = require('lodash'),
  uuid = require('node-uuid'),
  Promise = require('bluebird'),
  formatProcessing = require('../core/auth/formatProcessing'),
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  PartialError = require('kuzzle-common-objects').errors.PartialError,
  SizeLimitError = require('kuzzle-common-objects').errors.SizeLimitError,
  Request = require('kuzzle-common-objects').Request,
  User = require('../core/models/security/user'),
  Role = require('../core/models/security/role'),
  Profile = require('../core/models/security/profile'),
  assertHasBody = require('./util/requestAssertions').assertHasBody,
  assertBodyHasAttribute = require('./util/requestAssertions').assertBodyHasAttribute,
  assertBodyHasNotAttribute = require('./util/requestAssertions').assertBodyHasNotAttribute,
  assertBodyAttributeType = require('./util/requestAssertions').assertBodyAttributeType,
  assertHasId = require('./util/requestAssertions').assertHasId,
  assertIdStartsNotUnderscore = require('./util/requestAssertions').assertIdStartsNotUnderscore;

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function SecurityController (kuzzle) {
  /**
   * Get the role mapping
   *
   * @returns {Promise}
   */
  this.getRoleMapping = function securityGetRoleMapping () {
    return kuzzle.internalEngine.getMapping({index: kuzzle.internalEngine.index, type: 'roles'})
      .then(response => ({mapping: response[kuzzle.internalEngine.index].mappings.roles.properties}));
  };

  /**
   * Update the roles collection mapping

   * @param {Request} request
   * @returns {Promise}
   */
  this.updateRoleMapping = function securityUpdateRoleMapping (request) {
    assertHasBody(request);
    return kuzzle.internalEngine.updateMapping('roles', request.input.body);
  };

  /**
   * Get the profile mapping
   *
   * @returns {Promise}
   */
  this.getProfileMapping = function securityGetProfileMapping () {
    return kuzzle.internalEngine.getMapping({index: kuzzle.internalEngine.index, type: 'profiles'})
      .then(response => ({mapping: response[kuzzle.internalEngine.index].mappings.profiles.properties}));
  };

  /**
   * Update the profiles collection mapping

   * @param {Request} request
   * @returns {Promise}
   */
  this.updateProfileMapping = function securityUpdateProfileMapping (request) {
    assertHasBody(request);
    return kuzzle.internalEngine.updateMapping('profiles', request.input.body);
  };

  /**
   * Get the user mapping
   *
   * @returns {Promise}
   */
  this.getUserMapping = function securityGetUserMapping () {
    return kuzzle.internalEngine.getMapping({index: kuzzle.internalEngine.index, type: 'users'})
      .then(response => ({mapping: response[kuzzle.internalEngine.index].mappings.users.properties}));
  };

  /**
   * Update the users collection mapping

   * @param {Request} request
   * @returns {Promise}
   */
  this.updateUserMapping = function securityUpdateUserMapping (request) {
    assertHasBody(request);
    return kuzzle.internalEngine.updateMapping('users', request.input.body);
  };

  /**
   * Get a specific role according to the given id
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.getRole = function securityGetRole (request) {
    assertHasId(request);

    return kuzzle.repositories.role.loadRole(request.input.resource._id)
      .then(role => {
        if (!role) {
          return Promise.reject(new NotFoundError(`Role with id ${request.input.resource._id} not found`));
        }

        return formatProcessing.formatRoleForSerialization(role);
      });
  };

  /**
   * Get specific roles according to given ids
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.mGetRoles = function securityMGetRoles (request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'ids');
    assertBodyAttributeType(request, 'ids', 'array');

    return kuzzle.repositories.role.loadMultiFromDatabase(request.input.body.ids)
      .then(roles => {
        roles = roles.map(role => formatProcessing.formatRoleForSerialization(role));
        return {hits: roles, total: roles.length};
      });
  };

  /**
   * Return a list of roles that specify a right for the given indexes
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.searchRoles = function securitySearchRoles (request) {
    checkSearchPageLimit(request, kuzzle.config.limits.documentsFetchCount);

    let
      controllers = request.input.body && request.input.body.controllers,
      from = request.input.args && request.input.args.from,
      size = request.input.args && request.input.args.size;

    return kuzzle.repositories.role.searchRole(controllers, from, size)
      .then(response => {
        response.hits = response.hits.map((role => {
          return formatProcessing.formatRoleForSerialization(role);
        }));

        return response;
      });
  };

  /**
   * Create or replace a Role
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.createOrReplaceRole = function securityCreateOrReplaceRole (request) {
    assertHasBody(request);
    assertHasId(request);

    return createOrReplaceRole.call(kuzzle, request, {method: 'createOrReplace'})
      .then(role => formatProcessing.formatRoleForSerialization(role));
  };

  /**
   * Create a Role
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.createRole = function securityCreateRole (request) {
    assertHasBody(request);
    assertHasId(request);
    assertIdStartsNotUnderscore(request);

    return createOrReplaceRole.call(kuzzle, request, {method: 'create'})
      .then(role => formatProcessing.formatRoleForSerialization(role));
  };

  /**
   * Remove a role according to the given id
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.deleteRole = function securityDeleteRole (request) {
    let role;

    assertHasId(request);

    role = kuzzle.repositories.role.getRoleFromRequest(request);

    return kuzzle.repositories.role.deleteRole(role);
  };

  /**
   * Get a specific profile according to the given id
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.getProfile = function securityGetProfile (request) {
    assertHasId(request);

    return kuzzle.repositories.profile.loadProfile(request.input.resource._id)
      .then(profile => {
        if (!profile) {
          return Promise.reject(new NotFoundError(`Profile with id ${request.input.resource._id} not found`));
        }

        return formatProcessing.formatProfileForSerialization(profile);
      });
  };

  /**
   * Get specific profiles according to given ids
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.mGetProfiles = function securityMGetProfiles (request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'ids');
    assertBodyAttributeType(request, 'ids', 'array');

    return kuzzle.repositories.profile.loadMultiFromDatabase(request.input.body.ids)
      .then(profiles => {
        profiles = profiles.map(profile => formatProcessing.formatProfileForSerialization(profile));
        return {hits: profiles, total: profiles.length};
      });
  };

  /**
   * Create or replace a Profile
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.createOrReplaceProfile = function securityCreateOrReplaceProfile (request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'policies');
    assertBodyAttributeType(request, 'policies', 'array');
    assertHasId(request);
    assertIdStartsNotUnderscore(request);

    return createOrReplaceProfile(kuzzle, request, {method: 'createOrReplace'})
      .then(profile => formatProcessing.formatProfileForSerialization(profile));
  };

  /**
   * Create a Profile
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.createProfile = function securityCreateProfile (request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'policies');
    assertBodyAttributeType(request, 'policies', 'array');
    assertHasId(request);
    assertIdStartsNotUnderscore(request);

    return createOrReplaceProfile(kuzzle, request, {method: 'create'})
      .then(profile => formatProcessing.formatProfileForSerialization(profile));
  };

  /**
   * Deletes a profile
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.deleteProfile = function securityDeleteProfile (request) {
    assertHasId(request);

    return kuzzle.repositories.profile.buildProfileFromRequest(request)
      .then(profile => kuzzle.repositories.profile.deleteProfile(profile));
  };

  /**
   * Returns a list of profiles that contain a given set of roles
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.searchProfiles = function securitySearchProfiles (request) {
    let roles = [];

    checkSearchPageLimit(request, kuzzle.config.limits.documentsFetchCount);

    if (request.input.body && request.input.body.policies) {
      roles = request.input.body.policies;
    }

    return kuzzle.repositories.profile.searchProfiles(roles, request.input.args.from, request.input.args.size)
      .then(response => {
        response.hits = response.hits.map(profile => formatProcessing.formatProfileForSerialization(profile));
        return response;
      });
  };

  /**
   * Given a user id, returns the matching User object
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.getUser = function securityGetUser (request) {
    assertHasId(request);

    return kuzzle.repositories.user.load(request.input.resource._id)
      .then(user => {
        if (!user) {
          return Promise.reject(new NotFoundError(`User with id ${request.input.resource._id} not found`));
        }

        return formatProcessing.formatUserForSerialization(kuzzle, user);
      });
  };

  /**
   * Given a profile id, returns the matching profile's rights as an array.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.getProfileRights = function securityGetProfileRights (request) {
    assertHasId(request);

    return kuzzle.repositories.profile.loadProfile(request.input.resource._id)
      .then(profile => {
        if (!profile) {
          return Promise.reject(new NotFoundError(`Profile with id ${request.input.resource._id} not found`));
        }

        return profile.getRights(kuzzle);
      })
      .then(rights => Object.keys(rights).reduce((array, item) => array.concat(rights[item]), []))
      .then(rights => ({hits: rights, total: rights.length}));
  };

  /**
   * Given a user id, returns the matching user's rights as an array.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.getUserRights = function securityGetUserRights (request) {
    assertHasId(request);

    return kuzzle.repositories.user.load(request.input.resource._id)
      .then(user => {
        if (!user) {
          throw new NotFoundError(`User with id ${request.input.resource._id} not found`);
        }

        return user.getRights(kuzzle);
      })
      .then(rights => Object.keys(rights).reduce((array, item) => array.concat(rights[item]), []))
      .then(rights => ({hits: rights, total: rights.length}));
  };

  /**
   * Returns the User objects matching the given query
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.searchUsers = function securitySearchUsers (request) {
    let total;

    checkSearchPageLimit(request, kuzzle.config.limits.documentsFetchCount);

    return kuzzle.repositories.user.search(
      request.input.body && request.input.body.query ? request.input.body.query : {},
      request.input.args.from,
      request.input.args.size
    ).then(response => {
      let promises = response.hits.map(user => formatProcessing.formatUserForSerialization(kuzzle, user));
      total = response.total;

      return Promise.all(promises);
    })
    .then(formattedUsers => ({hits: formattedUsers, total}));
  };

  /**
   * Deletes a User from Kuzzle
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.deleteUser = function securityDeleteUser (request) {
    assertHasId(request);

    return kuzzle.repositories.user.delete(request.input.resource._id)
      .then(() => ({ _id: request.input.resource._id}));
  };

  /**
   * Creates a new User object in Kuzzle's database layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.createUser = function securityCreateUser (request) {
    const user = new User();
    let pojoUser;

    assertHasBody(request);
    assertBodyHasAttribute(request, 'profileIds');
    assertBodyAttributeType(request, 'profileIds', 'array');
    assertIdStartsNotUnderscore(request);

    pojoUser = request.input.body;
    pojoUser._id = request.input.resource._id || uuid.v4();

    return kuzzle.repositories.user.hydrate(user, pojoUser)
      .then(modifiedUser => kuzzle.repositories.user.persist(modifiedUser, { database: {method: 'create'} }))
      .then(modifiedUser => formatProcessing.formatUserForSerialization(kuzzle, modifiedUser));
  };

  /**
   * Creates a new User object in Kuzzle's database layer and applies restricted profileIds
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.createRestrictedUser = function securityCreateRestrictedUser (request) {
    let
      user = new User(),
      pojoUser;

    assertHasBody(request);
    assertBodyHasNotAttribute(request, 'profileIds');
    assertIdStartsNotUnderscore(request);

    pojoUser = request.input.body;
    pojoUser._id = request.input.resource._id || uuid.v4();
    pojoUser.profileIds = kuzzle.config.security.restrictedProfileIds;

    return kuzzle.repositories.user.hydrate(user, pojoUser)
      .then(modifiedUser => kuzzle.repositories.user.persist(modifiedUser, {database: {method: 'create'}}))
      .then(modifiedUser => formatProcessing.formatUserForSerialization(kuzzle, modifiedUser));
  };

  /**
   * Updates an existing User
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.updateUser = function securityUpdateUser (request) {
    assertHasBody(request);
    assertHasId(request);

    return kuzzle.repositories.user.load(request.input.resource._id)
      .then(user => kuzzle.repositories.user.persist(_.extend(user, request.input.body), {database: {method: 'update'}}))
      .then(updatedUser => formatProcessing.formatUserForSerialization(kuzzle, updatedUser));
  };

  /**
   * Updates an existing profile
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.updateProfile = function securityUpdateProfile (request) {
    assertHasBody(request);
    assertHasId(request);

    return kuzzle.repositories.profile.loadProfile(request.input.resource._id)
      .then(profile => kuzzle.repositories.profile.validateAndSaveProfile(_.extend(profile, request.input.body), {method: 'update'}))
      .then(updatedProfile => formatProcessing.formatProfileForSerialization(updatedProfile));
  };

  /**
   * Updates an existing role
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.updateRole = function securityUpdateRole (request) {
    assertHasBody(request);
    assertHasId(request);

    return kuzzle.repositories.role.loadRole(request.input.resource._id)
      .then(role => {
        if (!role) {
          return Promise.reject(new NotFoundError('Cannot update role "' + request.input.resource._id + '": role not found'));
        }

        return kuzzle.repositories.role.validateAndSaveRole(_.extend(role, request.input.body), {method: 'update'});
      })
      .then(updatedRole => formatProcessing.formatRoleForSerialization(updatedRole));
  };

  /**
   * Creates or replaces a User in Kuzzle
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.createOrReplaceUser = function securityCreateOrReplaceUser (request) {
    const user = new User();

    assertHasBody(request);
    assertBodyHasAttribute(request, 'profileIds');
    assertHasId(request);
    assertIdStartsNotUnderscore(request);

    user._id = request.input.resource._id;

    return kuzzle.repositories.user.hydrate(user, request.input.body)
      .then(modifiedUser => kuzzle.repositories.user.persist(modifiedUser))
      .then(modifiedUser => formatProcessing.formatUserForSerialization(kuzzle, modifiedUser));
  };

  /**
   * Creates the first admin user if it does not already exist
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.createFirstAdmin = function securityCreateFirstAdmin (request) {
    let reset;

    assertHasBody(request);
    assertIdStartsNotUnderscore(request);

    reset = request.input.args.reset || false;

    return kuzzle.funnel.controllers.server.adminExists()
      .then(adminExists => {
        if (adminExists.exists) {
          return Promise.reject(new Error('admin user is already set'));
        }

        delete request.input.args.reset;
        request.input.body.profileIds = ['admin'];
        request.input.resource._id = request.input.resource._id || uuid.v4();

        return kuzzle.funnel.controllers.security.createOrReplaceUser(request);
      })
      .then(response => {
        if (reset) {
          return resetRoles.call(kuzzle)
            .then(() => resetProfiles.call(kuzzle))
            .then(() => kuzzle.funnel.controllers.index.refreshInternal())
            .then(() => response);
        }

        return response;
      });
  };

  /**
   * Deletes multiple profiles
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  this.mDeleteProfiles = function securityMDeleteProfiles (request) {
    return mDelete(kuzzle, 'profile', request);
  };

  /**
   * Deletes multiple roles
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  this.mDeleteRoles = function securityMDeleteRoles (request) {
    return mDelete(kuzzle, 'role', request);
  };

  /**
   * Deletes multiple users
   *
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  this.mDeleteUsers = function securityMDeleteUsers (request) {
    return mDelete(kuzzle, 'user', request);
  };
}

module.exports = SecurityController;

/**
 * @this Kuzzle
 * @param {Request} request
 * @param opts
 * @returns {Promise<Role>}
 */
function createOrReplaceRole (request, opts) {
  const role = this.repositories.role.getRoleFromRequest(request);

  return this.repositories.role.validateAndSaveRole(role, opts);
}

/**
 * @param {Kuzzle} kuzzle
 * @param {Request} request
 * @param opts
 * @returns {Promise<Profile>}
 */
function createOrReplaceProfile (kuzzle, request, opts) {
  return kuzzle.repositories.profile.buildProfileFromRequest(request)
    .then(profile => kuzzle.repositories.profile.hydrate(profile, request.input.body))
    .then(hydratedProfile => kuzzle.repositories.profile.validateAndSaveProfile(hydratedProfile, opts));
}

/**
 * @this {Kuzzle}
 * @returns {Promise.<*>}
 */
function resetRoles () {
  let promises = ['admin', 'default', 'anonymous'].map(id => {
    let role = Object.assign(new Role(), {_id: id}, this.config.security.standard.roles[id]);
    return this.repositories.role.validateAndSaveRole(role);
  });

  return Promise.all(promises);
}

/**
 * @this {Kuzzle}
 * @returns {Promise.<*>}
 */
function resetProfiles () {
  let promises = ['admin', 'default', 'anonymous'].map(id => {
    let profile = Object.assign(new Profile(), {_id: id, policies: [{roleId: id}]});
    return this.repositories.profile.validateAndSaveProfile(profile);
  });

  return Promise.all(promises);
}

/**
 *
 * @param {Kuzzle} kuzzle
 * @param {string.<profile|role|user>} type
 * @param {Request} request
 * @returns {Promise.<*>}
 */
function mDelete (kuzzle, type, request) {
  const
    action = _.upperFirst(type);

  assertHasBody(request);
  assertBodyHasAttribute(request, 'ids');
  assertBodyAttributeType(request, 'ids', 'array');

  if (request.input.body.ids.length > kuzzle.config.limits.documentsWriteCount) {
    throw new BadRequestError(`Number of delete to perform exceeds the server configured value (${kuzzle.config.limits.documentsWriteCount})`);
  }

  return Promise.all(request.input.body.ids.map(id => {
    const deleteRequest = new Request({
      controller: 'security',
      action: `delete${action}`,
      _id: id
    }, request.context);

    return new Promise(resolve => {
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
    let size = request.input.args.size - (request.input.args.from || 0);

    if (size > limit) {
      throw new SizeLimitError(`Search page size exceeds server configured documents limit (${limit})`);
    }
  }
}