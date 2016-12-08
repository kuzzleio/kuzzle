'use strict';

var
  _ = require('lodash'),
  uuid = require('node-uuid'),
  Promise = require('bluebird'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  formatProcessing = require('../core/auth/formatProcessing'),
  User = require('../core/models/security/user'),
  assertHadBody = require('./util/requestAssertions').assertHadBody,
  assertBodyHasAttribute = require('./util/requestAssertions').assertBodyHasAttribute,
  assertBodyHasNotAttribute = require('./util/requestAssertions').assertBodyHasNotAttribute,
  assertHasId = require('./util/requestAssertions').assertHasId;

/**
 * @param {Kuzzle} kuzzle
 * @constructor
 */
function SecurityController (kuzzle) {
  /**
   * Get a specific role according to the given id
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.getRole = function securityGetRole (request) {
    assertHasId(request, 'getRole');

    return kuzzle.repositories.role.loadRole(request.input.resource._id)
      .then(role => {
        if (!role) {
          return Promise.reject(new NotFoundError(`Role with id ${request.input.resource._id} not found`));
        }

        return Promise.resolve(formatProcessing.formatRoleForSerialization(role));
      });
  };

  /**
   * Get specific roles according to given ids
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.mGetRoles = function securityMGetRoles (request) {
    assertHadBody(request, 'mGetRoles');
    assertBodyHasAttribute(request, 'ids', 'mGetRoles');

    if (!Array.isArray(request.input.body.ids)) {
      throw new BadRequestError('mGetRoles must specify an array of "ids"');
    }

    return kuzzle.repositories.role.loadMultiFromDatabase(request.input.body.ids)
      .then(roles => {
        roles = roles.map((role => {
          return formatProcessing.formatRoleForSerialization(role);
        }));

        return Promise.resolve({hits: roles, total: roles.length});
      });
  };

  /**
   * Return a list of roles that specify a right for the given indexes
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.searchRoles = function securitySearchRoles (request) {
    return kuzzle.repositories.role.searchRole(request)
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
    assertHadBody(request, 'createOrReplaceRole');
    assertHasId(request, 'createOrReplaceRole');

    return createOrReplaceRole.call(kuzzle, request, {method: 'createOrReplace'})
      .then(role => Promise.resolve(formatProcessing.formatRoleForSerialization(role)));
  };

  /**
   * Create a Role
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.createRole = function securityCreateRole (request) {
    assertHadBody(request, 'createRole');
    assertHasId(request, 'createRole');

    return createOrReplaceRole.call(kuzzle, request, {method: 'create'})
      .then(role => Promise.resolve(formatProcessing.formatRoleForSerialization(role)));
  };

  /**
   * Remove a role according to the given id
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.deleteRole = function securityDeleteRole (request) {
    var role;

    assertHasId(request, 'deleteRole');

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
    assertHasId(request, 'getProfile');

    return kuzzle.repositories.profile.loadProfile(request.input.resource._id)
      .then(profile => {
        if (!profile) {
          return Promise.reject(new NotFoundError(`Profile with id ${request.input.resource._id} not found`));
        }

        return Promise.resolve(formatProcessing.formatProfileForSerialization(profile));
      });
  };

  /**
   * Get specific profiles according to given ids
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.mGetProfiles = function securityMGetProfiles (request) {
    assertHadBody(request, 'mGetProfiles');
    assertBodyHasAttribute(request, 'ids', 'mGetProfiles');

    if (!Array.isArray(request.input.body.ids)) {
      throw new BadRequestError('mGetProfiles must specify an array of "ids"');
    }

    return kuzzle.repositories.profile.loadMultiFromDatabase(request.input.body.ids)
      .then(profiles => {
        profiles = profiles.map(profile => formatProcessing.formatProfileForSerialization(profile));

        return Promise.resolve({hits: profiles, total: profiles.length});
      });
  };

  /**
   * Create or replace a Profile
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.createOrReplaceProfile = function securityCreateOrReplaceProfile (request) {
    assertHadBody(request, 'createOrReplaceProfile');
    assertHadBody(request, 'policies', 'createOrReplaceProfile');

    if (!_.isArray(request.input.body.policies)) {
      throw new BadRequestError('createOrReplaceProfile must specify an array of "policies"');
    }

    return createOrReplaceProfile(kuzzle, request, {method: 'createOrReplace'})
      .then(profile => Promise.resolve(formatProcessing.formatProfileForSerialization(profile)));
  };

  /**
   * Create a Profile
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.createProfile = function securityCreateProfile (request) {
    assertHadBody(request, 'createProfile');
    assertHadBody(request, 'policies', 'createProfile');

    if (!_.isArray(request.input.body.policies)) {
      throw new BadRequestError('createOrReplaceProfile must specify an array of "policies"');
    }

    return createOrReplaceProfile(kuzzle, request, {method: 'create'})
      .then(profile => Promise.resolve(formatProcessing.formatProfileForSerialization(profile)));
  };

  /**
   * Deletes a profile
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.deleteProfile = function securityDeleteProfile (request) {
    assertHasId(request, 'deleteProfile');

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
    var roles = [];

    if (request.input.body && request.input.body.policies) {
      roles = request.input.body.policies;
    }

    return kuzzle.repositories.profile.searchProfiles(roles, request.input.args.from, request.input.args.size)
      .then((response) => {
        response.hits = response.hits.map((profile) => {
          return formatProcessing.formatProfileForSerialization(profile);
        });

        return Promise.resolve(response);
      });
  };

  /**
   * Given a user id, returns the matching User object
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.getUser = function securityGetUser (request) {
    assertHasId(request, 'getUser');

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
    assertHasId(request, 'getProfileRights');

    return kuzzle.repositories.profile.loadProfile(request.input.resource._id)
      .then(profile => {
        if (!profile) {
          return Promise.reject(new NotFoundError(`Profile with id ${request.input.resource._id} not found`));
        }

        return profile.getRights(kuzzle);
      })
      .then(rights => Promise.resolve(Object.keys(rights).reduce((array, item) => array.concat(rights[item]), [])))
      .then(rights => Promise.resolve({hits: rights, total: rights.length}));
  };

  /**
   * Given a user id, returns the matching user's rights as an array.
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.getUserRights = function securityGetUserRights (request) {
    assertHasId(request, 'getUserRights');

    return kuzzle.repositories.user.load(request.input.resource._id)
      .then(user => {
        if (!user) {
          throw new NotFoundError(`User with id ${request.input.resource._id} not found`);
        }

        return user.getRights(kuzzle);
      })
      .then(rights => Object.keys(rights).reduce((array, item) => array.concat(rights[item]), []))
      .then(rights => Promise.resolve({hits: rights, total: rights.length}));
  };

  /**
   * Returns the User objects matching the given query
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.searchUsers = function securitySearchUsers (request) {
    var total;

    return kuzzle.repositories.user.search(
      request.input.body && request.input.body.query ? request.input.body.query : {},
      request.input.args.from,
      request.input.args.size
    ).then(response => {
      var promises = response.hits.map((user => {
        return formatProcessing.formatUserForSerialization(kuzzle, user);
      }));

      total = response.total;

      return Promise.all(promises)
        .then(formattedUsers => Promise.resolve({hits: formattedUsers, total: total}));
    });
  };

  /**
   * Deletes a User from Kuzzle
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.deleteUser = function securityDeleteUser (request) {
    assertHasId(request, 'deleteUser');

    return kuzzle.repositories.user.delete(request.input.resource._id)
      .then(() => Promise.resolve({ _id: request.input.resource._id}));
  };

  /**
   * Creates a new User object in Kuzzle's database layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.createUser = function securityCreateUser (request) {
    var
      user = new User(),
      pojoUser;

    assertHadBody(request, 'createUser');
    assertBodyHasAttribute(request, 'profileIds', 'createUser');

    if (!Array.isArray(request.input.body.profileIds)) {
      throw new BadRequestError('createUser must specify an array of "profileIds"');
    }

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
    var
      user = new User(),
      pojoUser;

    assertHadBody(request, 'createUser');
    assertBodyHasNotAttribute(request, 'profileIds', 'createUser');

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
    assertHadBody(request, 'updateUser');
    assertHasId(request, 'updateUser');

    return kuzzle.repositories.user.load(request.input.resource._id)
      .then(user => kuzzle.repositories.user.persist(_.extend(user, request.input.body), {database: {method: 'update'}}))
      .then(updatedUser => formatProcessing.formatUserForSerialization(kuzzle, updatedUser))
      .then(serializedUser => Promise.resolve(serializedUser));
  };

  /**
   * Updates an existing profile
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.updateProfile = function securityUpdateProfile (request) {
    assertHadBody(request, 'updateProfile');
    assertHasId(request, 'updateProfile');

    return kuzzle.repositories.profile.loadProfile(request.input.resource._id)
      .then(profile => kuzzle.repositories.profile.validateAndSaveProfile(_.extend(profile, request.input.body), {method: 'update'}))
      .then(updatedProfile => Promise.resolve(formatProcessing.formatProfileForSerialization(updatedProfile)));
  };

  /**
   * Updates an existing role
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.updateRole = function securityUpdateRole (request) {
    assertHadBody(request, 'updateRole');
    assertHasId(request, 'updateRole');

    return kuzzle.repositories.role.loadRole(request.input.resource._id)
      .then(role => {
        if (!role) {
          return Promise.reject(new NotFoundError('Cannot update role "' + request.input.resource._id + '": role not found'));
        }

        return kuzzle.repositories.role.validateAndSaveRole(_.extend(role, request.input.body), {method: 'update'});
      })
      .then(updatedRole => Promise.resolve(formatProcessing.formatRoleForSerialization(updatedRole)));
  };

  /**
   * Creates or replaces a User in Kuzzle
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.createOrReplaceUser = function securityCreateOrReplaceUser (request) {
    var user = new User();

    assertHadBody(request, 'createOrReplaceUser');
    assertBodyHasAttribute(request, 'profileIds', 'createOrReplaceUser');

    if (request.input.resource._id) {
      user._id = request.input.resource._id;
    }

    return kuzzle.repositories.user.hydrate(user, request.input.body)
      .then(modifiedUser => kuzzle.repositories.user.persist(modifiedUser))
      .then(modifiedUser => formatProcessing.formatUserForSerialization(kuzzle, modifiedUser))
      .then(modifiedUser => Promise.resolve(modifiedUser));
  };
}

/**
 * @this Kuzzle
 * @param {Request} request
 * @param opts
 * @returns {Promise<Role>}
 */
function createOrReplaceRole (request, opts) {
  var role = this.repositories.role.getRoleFromRequest(request);

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

module.exports = SecurityController;
