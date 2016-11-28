var
  _ = require('lodash'),
  uuid = require('node-uuid'),
  Promise = require('bluebird'),
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  ResponseObject = require('kuzzle-common-objects').Models.responseObject,
  NotFoundError = require('kuzzle-common-objects').Errors.notFoundError,
  formatProcessing = require('../core/auth/formatProcessing'),
  User = require('../core/models/security/user');

function SecurityController (kuzzle) {
  /**
   * Get a specific role according to the given id
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.getRole = function securityGetRole (requestObject, userContext) {
    return kuzzle.repositories.role.loadRole(requestObject.data._id)
      .then(role => {
        if (!role) {
          return Promise.reject(new NotFoundError(`Role with id ${requestObject.data._id} not found`));
        }

        return Promise.resolve({
          responseObject: new ResponseObject(requestObject, formatProcessing.formatRoleForSerialization(role)),
          userContext
        });
      });
  };

  /**
   * Get specific roles according to given ids
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.mGetRoles = function securityMGetRoles (requestObject, userContext) {
    if (!requestObject.data.body || !requestObject.data.body.ids || !Array.isArray(requestObject.data.body.ids)) {
      return Promise.reject(new BadRequestError('Missing role ids'));
    }

    return kuzzle.repositories.role.loadMultiFromDatabase(requestObject.data.body.ids)
      .then(roles => {
        roles = roles.map((role => {
          return formatProcessing.formatRoleForSerialization(role);
        }));

        return Promise.resolve({
          responseObject: new ResponseObject(requestObject, {hits: roles, total: roles.length}),
          userContext
        });
      });
  };

  /**
   * Return a list of roles that specify a right for the given indexes
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.searchRoles = function securitySearchRoles (requestObject, userContext) {
    return kuzzle.repositories.role.searchRole(requestObject)
      .then(response => {
        response.hits = response.hits.map((role => {
          return formatProcessing.formatRoleForSerialization(role);
        }));

        return response;
      })
      .then(response => Promise.resolve({
        responseObject: new ResponseObject(requestObject, response),
        userContext
      }));
  };

  /**
   * Create or replace a Role
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.createOrReplaceRole = function securityCreateOrReplaceRole (requestObject, userContext) {
    return createOrReplaceRole.call(kuzzle, requestObject, userContext, {method: 'createOrReplace'})
      .then(role => Promise.resolve({
        responseObject: new ResponseObject(requestObject, formatProcessing.formatRoleForSerialization(role)),
        userContext
      }));
  };

  /**
   * Create a Role
   *
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.createRole = function securityCreateRole (requestObject, userContext) {
    return createOrReplaceRole.call(kuzzle, requestObject, userContext, {method: 'create'})
      .then(role => Promise.resolve({
        responseObject: new ResponseObject(requestObject, formatProcessing.formatRoleForSerialization(role)),
        userContext
      }));
  };

  /**
   * Remove a role according to the given id
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.deleteRole = function securityDeleteRole (requestObject, userContext) {
    var role = kuzzle.repositories.role.getRoleFromRequestObject(requestObject);

    return kuzzle.repositories.role.deleteRole(role)
      .then(response => Promise.resolve({
        responseObject: new ResponseObject(requestObject, response),
        userContext
      }));
  };

  /**
   * Get a specific profile according to the given id
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.getProfile = function securityGetProfile (requestObject, userContext) {
    if (!requestObject.data._id) {
      return Promise.reject(new BadRequestError('Missing profile id'));
    }

    return kuzzle.repositories.profile.loadProfile(requestObject.data._id)
      .then(profile => {
        if (!profile) {
          return Promise.reject(new NotFoundError(`Profile with id ${requestObject.data._id} not found`));
        }

        return Promise.resolve({
          responseObject: new ResponseObject(requestObject, formatProcessing.formatProfileForSerialization(profile)),
          userContext
        });
      });
  };

  /**
   * Get specific profiles according to given ids
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.mGetProfiles = function securityMGetProfiles (requestObject, userContext) {
    if (!requestObject.data.body || !requestObject.data.body.ids || !Array.isArray(requestObject.data.body.ids)) {
      return Promise.reject(new BadRequestError('Missing profile ids'));
    }

    return kuzzle.repositories.profile.loadMultiFromDatabase(requestObject.data.body.ids)
      .then(profiles => {
        profiles = profiles.map(profile => formatProcessing.formatProfileForSerialization(profile));

        return Promise.resolve({
          responseObject: new ResponseObject(requestObject, {hits: profiles, total: profiles.length}),
          userContext
        });
      });
  };

  /**
   * Create or replace a Profile
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.createOrReplaceProfile = function securityCreateOrReplaceProfile (requestObject, userContext) {
    return createOrReplaceProfile.call(kuzzle, requestObject, userContext, {method: 'createOrReplace'})
      .then(profile => Promise.resolve({
        responseObject: new ResponseObject(requestObject, formatProcessing.formatProfileForSerialization(profile)),
        userContext
      }));
  };

  /**
   * Create a Profile
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.createProfile = function securityCreateProfile (requestObject, userContext) {
    return createOrReplaceProfile.call(kuzzle, requestObject, userContext, {method: 'create'})
      .then(profile => Promise.resolve({
        responseObject: new ResponseObject(requestObject, formatProcessing.formatProfileForSerialization(profile)),
        userContext
      }));
  };

  /**
   * Deletes a profile
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.deleteProfile = function securityDeleteProfile (requestObject, userContext) {
    return kuzzle.repositories.profile.buildProfileFromRequestObject(requestObject)
      .then(profile => kuzzle.repositories.profile.deleteProfile(profile))
      .then(response => Promise.resolve({
        responseObject: new ResponseObject(requestObject, response),
        userContext
      }));
  };

  /**
   * Returns a list of profiles that contain a given set of roles
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.searchProfiles = function securitySearchProfiles (requestObject, userContext) {
    var roles = [];

    if (requestObject.data.body && requestObject.data.body.policies) {
      roles = requestObject.data.body.policies;
    }

    return kuzzle.repositories.profile.searchProfiles(roles, requestObject.data.body.from, requestObject.data.body.size)
      .then((response) => {
        response.hits = response.hits.map((profile) => {
          return formatProcessing.formatProfileForSerialization(profile);
        });

        return Promise.resolve({
          responseObject: new ResponseObject(requestObject, response),
          userContext
        });
      });
  };

  /**
   * Given a user id, returns the matching User object
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.getUser = function securityGetUser (requestObject, userContext) {
    return kuzzle.repositories.user.load(requestObject.data._id)
      .then(user => {
        if (!user) {
          return Promise.reject(new NotFoundError(`User with id ${requestObject.data._id} not found`));
        }

        return formatProcessing.formatUserForSerialization(kuzzle, user);
      })
      .then(response => Promise.resolve({
        responseObject: new ResponseObject(requestObject, response),
        userContext
      }));
  };

  /**
   * Given a profile id, returns the matching profile's rights as an array.
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.getProfileRights = function securityGetProfileRights (requestObject, userContext) {
    if (!requestObject.data._id) {
      return Promise.reject(new BadRequestError('No profile id given'));
    }

    return kuzzle.repositories.profile.loadProfile(requestObject.data._id)
      .then(profile => {
        if (!profile) {
          return Promise.reject(new NotFoundError(`Profile with id ${requestObject.data._id} not found`));
        }

        return profile.getRights(kuzzle);
      })
      .then(rights => Promise.resolve(Object.keys(rights).reduce((array, item) => array.concat(rights[item]), [])))
      .then(rights => {
        return kuzzle.pluginsManager.trigger('security:afterGetProfileRights', {
          responseObject: new ResponseObject(requestObject, {hits: rights, total: rights.length}),
          userContext
        });
      });
  };

  /**
   * Given a user id, returns the matching user's rights as an array.
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.getUserRights = function securityGetUserRights (requestObject, userContext) {
    if (!requestObject.data._id) {
      return Promise.reject(new BadRequestError('No user id given'));
    }

    return kuzzle.repositories.user.load(requestObject.data._id)
      .then(user => {
        if (!user) {
          return Promise.reject(new NotFoundError(`User with id ${requestObject.data._id} not found`));
        }

        return user.getRights(kuzzle);
      })
      .then(rights => Object.keys(rights).reduce((array, item) => array.concat(rights[item]), []))
      .then(rights => {
        return Promise.resolve({
          responseObject: new ResponseObject(requestObject, {hits: rights, total: rights.length}),
          userContext
        });
      });
  };

  /**
   * Returns the User objects matching the given query
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.searchUsers = function securitySearchUsers (requestObject, userContext) {
    var total;

    return kuzzle.repositories.user.search(requestObject.data.body.query || {}, requestObject.data.body.from, requestObject.data.body.size)
      .then(response => {
        var promises = response.hits.map((user => {
          return formatProcessing.formatUserForSerialization(kuzzle, user);
        }));

        total = response.total;

        return Promise.all(promises)
          .then(formattedUsers => {
            return Promise.resolve({
              responseObject: new ResponseObject(requestObject, {hits: formattedUsers, total: total}),
              userContext
            });
          });
      });
  };

  /**
   * Deletes a User from Kuzzle
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.deleteUser = function securityDeleteUser (requestObject, userContext) {
    if (!requestObject.data._id) {
      return Promise.reject(new BadRequestError('No user id given'));
    }

    return kuzzle.repositories.user.delete(requestObject.data._id)
      .then(() => Promise.resolve({
        responseObject: new ResponseObject(requestObject, { _id: requestObject.data._id}),
        userContext
      }));
  };

  /**
   * Creates a new User object in Kuzzle's database layer
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.createUser = function securityCreateUser (requestObject, userContext) {
    var
      user = new User(),
      pojoUser;

    if (!requestObject.data.body || !requestObject.data.body.profileIds) {
      return Promise.reject(new BadRequestError('Invalid user object. No profileIds property found.'));
    }

    pojoUser = requestObject.data.body;
    pojoUser._id = (typeof requestObject.data._id !== 'undefined') ? requestObject.data._id : uuid.v4();

    return kuzzle.repositories.user.hydrate(user, pojoUser)
      .then(modifiedUser => kuzzle.repositories.user.persist(modifiedUser, { database: {method: 'create'} }))
      .then(modifiedUser => formatProcessing.formatUserForSerialization(kuzzle, modifiedUser))
      .then(serializedUser => Promise.resolve({
        responseObject: new ResponseObject(requestObject, serializedUser),
        userContext
      }));
  };

  /**
   * Creates a new User object in Kuzzle's database layer and applies restricted profileIds
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.createRestrictedUser = function securityCreateRestrictedUser (requestObject, userContext) {
    var
      user = new User(),
      pojoUser;

    if (!requestObject.data.body) {
      return Promise.reject(new BadRequestError('Invalid user object. No body provided'));
    }

    if (requestObject.data.body.profileIds) {
      return Promise.reject(new BadRequestError('Invalid restricted user. "profileIds" can not be provided.'));
    }

    pojoUser = requestObject.data.body;

    pojoUser._id = (typeof requestObject.data._id !== 'undefined') ? requestObject.data._id : uuid.v4();

    pojoUser.profileIds = kuzzle.config.security.restrictedProfileIds;

    return kuzzle.repositories.user.hydrate(user, pojoUser)
      .then(modifiedUser => kuzzle.repositories.user.persist(modifiedUser, {database: {method: 'create'}}))
      .then(modifiedUser => formatProcessing.formatUserForSerialization(kuzzle, modifiedUser))
      .then(serializedUser => Promise.resolve({
        responseObject: new ResponseObject(requestObject, serializedUser),
        userContext
      }));
  };

  /**
   * Updates an existing User
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.updateUser = function securityUpdateUser (requestObject, userContext) {
    if (!requestObject.data._id) {
      return Promise.reject(new BadRequestError('No user id given'));
    }

    if (requestObject.data.body._id) {
      return Promise.reject(new BadRequestError('_id can not be part of the body'));
    }

    return kuzzle.repositories.user.load(requestObject.data._id)
      .then(user => kuzzle.repositories.user.persist(_.extend(user, requestObject.data.body), {database: {method: 'update'}}))
      .then(updatedUser => formatProcessing.formatUserForSerialization(kuzzle, updatedUser))
      .then(serializedUser => Promise.resolve({
        responseObject: new ResponseObject(requestObject, serializedUser),
        userContext
      }));
  };

  /**
   * Updates an existing profile
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.updateProfile = function securityUpdateProfile (requestObject, userContext) {
    if (!requestObject.data._id) {
      return Promise.reject(new BadRequestError('No profile id given'));
    }

    if (requestObject.data.body._id) {
      return Promise.reject(new BadRequestError('_id can not be part of the body'));
    }

    return kuzzle.repositories.profile.loadProfile(requestObject.data._id)
      .then(profile => kuzzle.repositories.profile.validateAndSaveProfile(_.extend(profile, requestObject.data.body), userContext, {method: 'update'}))
      .then(updatedProfile => Promise.resolve({
        responseObject: new ResponseObject(requestObject, formatProcessing.formatProfileForSerialization(updatedProfile)),
        userContext
      }));
  };

  /**
   * Updates an existing role
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.updateRole = function securityUpdateRole (requestObject, userContext) {
    if (!requestObject.data._id) {
      return Promise.reject(new BadRequestError('No role id given'));
    }

    if (requestObject.data.body._id) {
      return Promise.reject(new BadRequestError('_id can not be part of the body'));
    }

    return kuzzle.repositories.role.loadRole(requestObject.data._id)
      .then(role => {
        if (!role) {
          return Promise.reject(new NotFoundError('Cannot update role "' + requestObject.data._id + '": role not found'));
        }

        return kuzzle.repositories.role.validateAndSaveRole(_.extend(role, requestObject.data.body), {method: 'update'});
      })
      .then(updatedRole => Promise.resolve({
        responseObject: new ResponseObject(requestObject, formatProcessing.formatRoleForSerialization(updatedRole)),
        userContext
      }));
  };

  /**
   * Creates or replaces a User in Kuzzle
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.createOrReplaceUser = function securityCreateOrReplaceUser (requestObject, userContext) {
    var user = new User();

    if (!requestObject.data.body || !requestObject.data.body.profileIds) {
      return Promise.reject(new BadRequestError('Invalid user object. No profile property found.'));
    }

    if (requestObject.data._id !== undefined) {
      user._id = requestObject.data._id;
    }

    return kuzzle.repositories.user.hydrate(user, requestObject.data.body)
      .then(modifiedUser => kuzzle.repositories.user.persist(modifiedUser))
      .then(modifiedUser => formatProcessing.formatUserForSerialization(kuzzle, modifiedUser))
      .then(modifiedUser => Promise.resolve({
        responseObject: new ResponseObject(requestObject, modifiedUser),
        userContext
      }));
  };
}

/**
 * @this Kuzzle
 * @param {RequestObject} requestObject
 * @param {Object} userContext
 * @param opts
 * @returns {Promise.<T>}
 */
function createOrReplaceRole (requestObject, userContext, opts) {
  var role = this.repositories.role.getRoleFromRequestObject(requestObject);

  return this.repositories.role.validateAndSaveRole(role, opts);
}

/**
 * @this Kuzzle
 * @param {RequestObject} requestObject
 * @param {Object} userContext
 * @param opts
 * @returns {Promise<Profile>}
 */
function createOrReplaceProfile (requestObject, userContext, opts) {
  if (!_.isArray(requestObject.data.body.policies)) {
    return Promise.reject(new BadRequestError('Policies property must be an array.'));
  }

  return this.repositories.profile.buildProfileFromRequestObject(requestObject)
    .then(profile => this.repositories.profile.hydrate(profile, requestObject.data.body))
    .then(hydratedProfile => this.repositories.profile.validateAndSaveProfile(hydratedProfile, userContext, opts));
}

module.exports = SecurityController;
