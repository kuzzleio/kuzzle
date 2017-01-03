'use strict';

var
  _ = require('lodash'),
  uuid = require('node-uuid'),
  Promise = require('bluebird'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  formatProcessing = require('../core/auth/formatProcessing'),
  User = require('../core/models/security/user'),
  assertHasBody = require('./util/requestAssertions').assertHasBody,
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
    assertHasId(request, 'security:getRole');

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
    assertHasBody(request, 'security:mGetRoles');
    assertBodyHasAttribute(request, 'ids', 'security:mGetRoles');

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
    assertHasBody(request, 'security:createOrReplaceRole');
    assertHasId(request, 'security:createOrReplaceRole');

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
    assertHasBody(request, 'security:createRole');
    assertHasId(request, 'security:createRole');

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

    assertHasId(request, 'security:deleteRole');

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
    assertHasBody(request, 'security:mGetProfiles');
    assertBodyHasAttribute(request, 'ids', 'security:mGetProfiles');

    if (!Array.isArray(request.input.body.ids)) {
      throw new BadRequestError('security:mGetProfiles must specify an array of "ids"');
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
    assertHasBody(request, 'security:createOrReplaceProfile');
    assertHasBody(request, 'policies', 'security:createOrReplaceProfile');

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
    assertHasBody(request, 'security:createProfile');
    assertHasBody(request, 'policies', 'security:createProfile');

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
    assertHasId(request, 'security:deleteProfile');

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
    assertHasId(request, 'security:getUser');

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
    assertHasId(request, 'security:getProfileRights');

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
    assertHasId(request, 'security:getUserRights');

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
    assertHasId(request, 'security:deleteUser');

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

    assertHasBody(request, 'security:createUser');
    assertBodyHasAttribute(request, 'profileIds', 'security:createUser');

    if (!Array.isArray(request.input.body.profileIds)) {
      throw new BadRequestError('security:createUser must specify an array of "profileIds"');
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

    assertHasBody(request, 'security:createUser');
    assertBodyHasNotAttribute(request, 'profileIds', 'security:createUser');

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
    assertHasBody(request, 'security:updateUser');
    assertHasId(request, 'security:updateUser');

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
    assertHasBody(request, 'security:updateProfile');
    assertHasId(request, 'security:updateProfile');

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
    assertHasBody(request, 'security:updateRole');
    assertHasId(request, 'security:updateRole');

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

    assertHasBody(request, 'security:createOrReplaceUser');
    assertBodyHasAttribute(request, 'profileIds', 'security:createOrReplaceUser');

    if (request.input.resource._id) {
      user._id = request.input.resource._id;
    }

    return kuzzle.repositories.user.hydrate(user, request.input.body)
      .then(modifiedUser => kuzzle.repositories.user.persist(modifiedUser))
      .then(modifiedUser => formatProcessing.formatUserForSerialization(kuzzle, modifiedUser))
      .then(modifiedUser => Promise.resolve(modifiedUser));
  };

  /**
   * Creates the first admin user if it does not already exist
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  this.createFirstAdmin = function securityCreateFirstAdmin (request) {
    var reset;

    assertHasBody(request, 'security:createFirstAdmin');

    reset = request.input.args.reset || false;

    return kuzzle.funnel.controllers.server.adminExists()
      .then(adminExists => {
        if (adminExists.exists) {
          return Promise.reject(new Error('admin user is already set'));
        }

        delete request.input.args.reset;
        request.input.body.profileIds = ['admin'];

        if (!request.input.resource._id) {
          request.input.resource._id = uuid.v4();
        }

        return kuzzle.funnel.controllers.security.createOrReplaceUser(request);
      })
      .then(response => {
        if (reset) {
          return resetRoles.call(kuzzle)
            .then(() => resetProfiles.call(kuzzle))
            .then(() => kuzzle.funnel.controllers.index.refreshInternal())
            .then(() => Promise.resolve(response));
        }

        return Promise.resolve(response);
      });
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

/**
 * @this {Kuzzle}
 * @returns {Promise.<*>}
 */
function resetRoles () {
  var promises;

  promises = ['admin', 'default', 'anonymous'].map(id => {
    return this.internalEngine.createOrReplace('roles', id, this.config.security.standard.roles[id]);
  });

  return Promise.all(promises);
}

/**
 * @this {Kuzzle}
 * @returns {Promise.<*>}
 */
function resetProfiles () {
  return this.internalEngine
    .createOrReplace('profiles', 'admin', {policies: [{roleId: 'admin', allowInternalIndex: true}]})
    .then(() => this.internalEngine.createOrReplace('profiles', 'anonymous', {policies: [{roleId: 'anonymous'}]}))
    .then(() => this.internalEngine.createOrReplace('profiles', 'default', {policies: [{roleId: 'default'}]}));
}

