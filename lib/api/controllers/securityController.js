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
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('security:beforeGetRole', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return kuzzle.repositories.role.loadRole(modifiedData.requestObject.data._id);
      })
      .then(role => {
        if (!role) {
          return Promise.reject(new NotFoundError(`Role with id ${modifiedData.requestObject.data._id} not found`));
        }

        return kuzzle.pluginsManager.trigger('security:afterGetRole', {
          responseObject: new ResponseObject(modifiedData.requestObject, formatProcessing.formatRoleForSerialization(role)),
          userContext: modifiedData.userContext
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
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('security:beforeMGetRoles', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        if (!modifiedData.requestObject.data.body || !modifiedData.requestObject.data.body.ids || !Array.isArray(modifiedData.requestObject.data.body.ids)) {
          return Promise.reject(new BadRequestError('Missing role ids'));
        }

        return kuzzle.repositories.role.loadMultiFromDatabase(modifiedData.requestObject.data.body.ids);
      })
      .then(roles => {
        roles = roles.map((role => {
          return formatProcessing.formatRoleForSerialization(role);
        }));

        return kuzzle.pluginsManager.trigger('security:afterMGetRoles', {
          responseObject: new ResponseObject(modifiedData.requestObject, {hits: roles, total: roles.length}),
          userContext: modifiedData.userContext
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
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('security:beforeSearchRole', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return kuzzle.repositories.role.searchRole(modifiedData.requestObject);
      })
      .then(response => {
        response.hits = response.hits.map((role => {
          return formatProcessing.formatRoleForSerialization(role);
        }));

        return response;
      })
      .then(response => kuzzle.pluginsManager.trigger('security:afterSearchRole', {
        responseObject: new ResponseObject(modifiedData.requestObject, response),
        userContext: modifiedData.userContext
      }));
  };

  /**
   * Create or replace a Role
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.createOrReplaceRole = function securityCreateOrReplaceRole (requestObject, userContext) {
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('security:beforeCreateOrReplaceRole', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return createOrReplaceRole.call(kuzzle, modifiedData.requestObject, modifiedData.userContext, {method: 'createOrReplace'});
      })
      .then(role => kuzzle.pluginsManager.trigger('security:afterCreateOrReplaceRole', {
        responseObject: new ResponseObject(modifiedData.requestObject, formatProcessing.formatRoleForSerialization(role)),
        userContext: modifiedData.userContext
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
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('security:beforeCreateRole', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return createOrReplaceRole.call(kuzzle, modifiedData.requestObject, modifiedData.userContext, {method: 'create'});
      })
      .then(role => kuzzle.pluginsManager.trigger('security:afterCreateRole', {
        responseObject: new ResponseObject(modifiedData.requestObject, formatProcessing.formatRoleForSerialization(role)),
        userContext: modifiedData.userContext
      }));
  };

  /**
   * Remove a role according to the given id
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.deleteRole = function securityDeleteRole (requestObject, userContext) {
    var
      modifiedData = null,
      role;

    return kuzzle.pluginsManager.trigger('security:beforeDeleteRole', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        role = kuzzle.repositories.role.getRoleFromRequestObject(modifiedData.requestObject);
        return kuzzle.repositories.role.deleteRole(role);
      })
      .then(response => kuzzle.pluginsManager.trigger('security:afterDeleteRole', {
        responseObject: new ResponseObject(modifiedData.requestObject, response),
        userContext: modifiedData.userContext
      }));
  };

  /**
   * Get a specific profile according to the given id
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.getProfile = function securityGetProfile (requestObject, userContext) {
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('security:beforeGetProfile', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        if (!modifiedData.requestObject.data._id) {
          return Promise.reject(new BadRequestError('Missing profile id'));
        }

        return kuzzle.repositories.profile.loadProfile(modifiedData.requestObject.data._id);
      })
      .then(profile => {
        if (!profile) {
          return Promise.reject(new NotFoundError(`Profile with id ${modifiedData.requestObject.data._id} not found`));
        }

        return kuzzle.pluginsManager.trigger('security:afterGetProfile',{
          responseObject: new ResponseObject(modifiedData.requestObject, formatProcessing.formatProfileForSerialization(profile)),
          userContext: modifiedData.userContext
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
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('security:beforeMGetProfiles', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        if (!modifiedData.requestObject.data.body || !modifiedData.requestObject.data.body.ids || !Array.isArray(modifiedData.requestObject.data.body.ids)) {
          return Promise.reject(new BadRequestError('Missing profile ids'));
        }

        return kuzzle.repositories.profile.loadMultiFromDatabase(modifiedData.requestObject.data.body.ids);
      })
      .then(profiles => {
        profiles = profiles.map(profile => formatProcessing.formatProfileForSerialization(profile));

        return kuzzle.pluginsManager.trigger('security:afterMGetProfiles', {
          responseObject: new ResponseObject(modifiedData.requestObject, {hits: profiles, total: profiles.length}),
          userContext: modifiedData.userContext
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
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('security:beforeCreateOrReplaceProfile', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return createOrReplaceProfile.call(kuzzle, modifiedData.requestObject, modifiedData.userContext, {method: 'createOrReplace'});
      })
      .then(profile => kuzzle.pluginsManager.trigger('security:afterCreateOrReplaceProfile', {
        responseObject: new ResponseObject(modifiedData.requestObject, formatProcessing.formatProfileForSerialization(profile)),
        userContext: modifiedData.userContext
      }));
  };

  /**
   * Create a Profile
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.createProfile = function securityCreateProfile (requestObject, userContext) {
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('security:beforeCreateProfile', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return createOrReplaceProfile.call(kuzzle, modifiedData.requestObject, modifiedData.userContext, {method: 'create'});
      })
      .then(profile => kuzzle.pluginsManager.trigger('security:afterCreateProfile', {
        responseObject: new ResponseObject(modifiedData.requestObject, formatProcessing.formatProfileForSerialization(profile)),
        userContext: modifiedData.userContext
      }));
  };

  /**
   * Deletes a profile
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.deleteProfile = function securityDeleteProfile (requestObject, userContext) {
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('security:beforeDeleteProfile', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return kuzzle.repositories.profile.buildProfileFromRequestObject(modifiedData.requestObject);
      })
      .then(profile => kuzzle.repositories.profile.deleteProfile(profile))
      .then(response => kuzzle.pluginsManager.trigger('security:afterDeleteProfile', {
        responseObject: new ResponseObject(modifiedData.requestObject, response),
        userContext: modifiedData.userContext
      }));
  };

  /**
   * Returns a list of profiles that contain a given set of roles
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.searchProfiles = function securitySearchProfiles (requestObject, userContext) {
    var
      roles = [],
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('security:beforeSearchProfiles', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        if (modifiedData.requestObject.data.body && modifiedData.requestObject.data.body.policies) {
          roles = modifiedData.requestObject.data.body.policies;
        }

        return kuzzle.repositories.profile.searchProfiles(
          roles,
          modifiedData.requestObject.data.body.from,
          modifiedData.requestObject.data.body.size
        );
      })
      .then((response) => {
        response.hits = response.hits.map((profile) => {
          return formatProcessing.formatProfileForSerialization(profile);
        });

        return kuzzle.pluginsManager.trigger('security:afterSearchProfiles', {
          responseObject: new ResponseObject(modifiedData.requestObject, response),
          userContext: modifiedData.userContext
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
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('security:beforeGetUser', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return kuzzle.repositories.user.load(modifiedData.requestObject.data._id);
      })
      .then(user => {
        if (!user) {
          return Promise.reject(new NotFoundError(`User with id ${modifiedData.requestObject.data._id} not found`));
        }

        return formatProcessing.formatUserForSerialization(kuzzle, user);
      })
      .then(response => kuzzle.pluginsManager.trigger('security:afterGetUser', {
        responseObject: new ResponseObject(modifiedData.requestObject, response),
        userContext: modifiedData.userContext
      }));
  };

  /**
   * Given a profile id, returns the matching profile's rights as an array.
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.getProfileRights = function securityGetProfileRights (requestObject, userContext) {
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('security:beforeGetProfileRights', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        if (!modifiedData.requestObject.data._id) {
          return Promise.reject(new BadRequestError('No profile id given'));
        }

        return kuzzle.repositories.profile.loadProfile(modifiedData.requestObject.data._id);
      })
      .then(profile => {
        if (!profile) {
          return Promise.reject(new NotFoundError(`Profile with id ${modifiedData.requestObject.data._id} not found`));
        }

        return profile.getRights(kuzzle);
      })
      .then(rights => Promise.resolve(Object.keys(rights).reduce((array, item) => array.concat(rights[item]), [])))
      .then(rights => {
        return kuzzle.pluginsManager.trigger('security:afterGetProfileRights', {
          responseObject: new ResponseObject(modifiedData.requestObject, {hits: rights, total: rights.length}),
          userContext: modifiedData.userContext
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
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('security:beforeGetUserRights', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        if (!modifiedData.requestObject.data._id) {
          return Promise.reject(new BadRequestError('No user id given'));
        }

        return kuzzle.repositories.user.load(modifiedData.requestObject.data._id);
      })
      .then(user => {
        if (!user) {
          return Promise.reject(new NotFoundError(`User with id ${modifiedData.requestObject.data._id} not found`));
        }

        return user.getRights(kuzzle);
      })
      .then(rights => Object.keys(rights).reduce((array, item) => array.concat(rights[item]), []))
      .then(rights => {
        return kuzzle.pluginsManager.trigger('security:afterGetUserRights', {
          responseObject: new ResponseObject(modifiedData.requestObject, {hits: rights, total: rights.length}),
          userContext: modifiedData.userContext
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
    var
      modifiedData = null,
      total;

    return kuzzle.pluginsManager.trigger('security:beforeSearchUsers', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        return kuzzle.repositories.user.search(
          modifiedData.requestObject.data.body.query || {},
          modifiedData.requestObject.data.body.from,
          modifiedData.requestObject.data.body.size
        );
      })
      .then(response => {
        var promises = response.hits.map((user => {
          return formatProcessing.formatUserForSerialization(kuzzle, user);
        }));

        total = response.total;

        return Promise.all(promises);
      })
      .then(formattedUsers => {
        return kuzzle.pluginsManager.trigger('security:afterSearchUsers', {
          responseObject: new ResponseObject(modifiedData.requestObject, {hits: formattedUsers, total: total}),
          userContext: modifiedData.userContext
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
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('security:beforeDeleteUser', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        if (!modifiedData.requestObject.data._id) {
          return Promise.reject(new BadRequestError('No user id given'));
        }

        return kuzzle.repositories.user.delete(modifiedData.requestObject.data._id);
      })
      .then(() => kuzzle.pluginsManager.trigger('security:afterDeleteUser', {
        responseObject: new ResponseObject(modifiedData.requestObject, { _id: modifiedData.requestObject.data._id}),
        userContext: modifiedData.userContext
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
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('security:beforeCreateUser', {requestObject, userContext})
      .then(data => {
        var pojoUser;
        modifiedData = data;

        if (!modifiedData.requestObject.data.body || !modifiedData.requestObject.data.body.profileIds) {
          return Promise.reject(new BadRequestError('Invalid user object. No profileIds property found.'));
        }

        pojoUser = modifiedData.requestObject.data.body;

        if (modifiedData.requestObject.data._id !== undefined) {
          pojoUser._id = modifiedData.requestObject.data._id;
        }
        else {
          pojoUser._id = uuid.v4();
        }

        return kuzzle.repositories.user.hydrate(user, pojoUser);
      })
      .then(modifiedUser => kuzzle.repositories.user.persist(modifiedUser, { database: {method: 'create'} }))
      .then(modifiedUser => formatProcessing.formatUserForSerialization(kuzzle, modifiedUser))
      .then(serializedUser => kuzzle.pluginsManager.trigger('security:afterCreateUser', {
        responseObject: new ResponseObject(modifiedData.requestObject, serializedUser),
        userContext: modifiedData.userContext
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
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('security:beforeCreateRestrictedUser', {requestObject, userContext})
      .then(data => {
        var pojoUser;

        modifiedData = data;

        if (!modifiedData.requestObject.data.body) {
          return Promise.reject(new BadRequestError('Invalid user object. No body provided'));
        }

        if (modifiedData.requestObject.data.body.profileIds) {
          return Promise.reject(new BadRequestError('Invalid restricted user. "profileIds" can not be provided.'));
        }

        pojoUser = modifiedData.requestObject.data.body;

        if (modifiedData.requestObject.data._id !== undefined) {
          pojoUser._id = modifiedData.requestObject.data._id;
        }
        else {
          pojoUser._id = uuid.v4();
        }

        pojoUser.profileIds = kuzzle.config.security.restrictedProfileIds;

        return kuzzle.repositories.user.hydrate(user, pojoUser);
      })
      .then(modifiedUser => kuzzle.repositories.user.persist(modifiedUser, { database: {method: 'create'} }))
      .then(modifiedUser => formatProcessing.formatUserForSerialization(kuzzle, modifiedUser))
      .then(serializedUser => kuzzle.pluginsManager.trigger('security:afterCreateRestrictedUser', {
        responseObject: new ResponseObject(modifiedData.requestObject, serializedUser),
        userContext: modifiedData.userContext
      }));
  };

  /**
   * Updates an existing User
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.updateUser = function securityUpdateUser (requestObject, userContext) {
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('security:beforeUpdateUser', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        if (!modifiedData.requestObject.data._id) {
          return Promise.reject(new BadRequestError('No user id given'));
        }

        if (modifiedData.requestObject.data.body._id) {
          return Promise.reject(new BadRequestError('_id can not be part of the body'));
        }

        return kuzzle.repositories.user.load(modifiedData.requestObject.data._id);
      })
      .then(user => kuzzle.repositories.user.persist(_.extend(user, modifiedData.requestObject.data.body), { database: { method: 'update' } }))
      .then(updatedUser => formatProcessing.formatUserForSerialization(kuzzle, updatedUser))
      .then(serializedUser => kuzzle.pluginsManager.trigger('security:afterUpdateUser', {
        responseObject: new ResponseObject(modifiedData.requestObject, serializedUser),
        userContext: modifiedData.userContext
      }));
  };

  /**
   * Updates an existing profile
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.updateProfile = function securityUpdateProfile (requestObject, userContext) {
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('security:beforeUpdateProfile', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        if (!modifiedData.requestObject.data._id) {
          return Promise.reject(new BadRequestError('No profile id given'));
        }

        if (modifiedData.requestObject.data.body._id) {
          return Promise.reject(new BadRequestError('_id can not be part of the body'));
        }

        return kuzzle.repositories.profile.loadProfile(modifiedData.requestObject.data._id);
      })
      .then(profile => kuzzle.repositories.profile.validateAndSaveProfile(_.extend(profile, modifiedData.requestObject.data.body), modifiedData.userContext, { method: 'update' }))
      .then(updatedProfile => kuzzle.pluginsManager.trigger('security:afterUpdateProfile', {
        responseObject: new ResponseObject(modifiedData.requestObject, formatProcessing.formatProfileForSerialization(updatedProfile)),
        userContext: modifiedData.userContext
      }));
  };

  /**
   * Updates an existing role
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.updateRole = function securityUpdateRole (requestObject, userContext) {
    var
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('security:beforeUpdateRole', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        if (!modifiedData.requestObject.data._id) {
          return Promise.reject(new BadRequestError('No role id given'));
        }

        if (modifiedData.requestObject.data.body._id) {
          return Promise.reject(new BadRequestError('_id can not be part of the body'));
        }

        return kuzzle.repositories.role.loadRole(modifiedData.requestObject.data._id);
      })
      .then(role => {
        if (!role) {
          return Promise.reject(new NotFoundError('Cannot update role "' + modifiedData.requestObject.data._id + '": role not found'));
        }

        return kuzzle.repositories.role.validateAndSaveRole(_.extend(role, modifiedData.requestObject.data.body), modifiedData.userContext, { method: 'update' });
      })
      .then(updatedRole => kuzzle.pluginsManager.trigger('security:afterUpdateRole', {
        responseObject: new ResponseObject(modifiedData.requestObject, formatProcessing.formatRoleForSerialization(updatedRole)),
        userContext: modifiedData.userContext
      }));
  };

  /**
   * Creates or replaces a User in Kuzzle
   * @param {RequestObject} requestObject
   * @param {Object} userContext
   * @returns {Promise}
   */
  this.createOrReplaceUser = function securityCreateOrReplaceUser (requestObject, userContext) {
    var
      user = new User(),
      modifiedData = null;

    return kuzzle.pluginsManager.trigger('security:beforeCreateOrReplaceUser', {requestObject, userContext})
      .then(data => {
        modifiedData = data;

        if (!modifiedData.requestObject.data.body || !modifiedData.requestObject.data.body.profileIds) {
          return Promise.reject(new BadRequestError('Invalid user object. No profile property found.'));
        }

        if (modifiedData.requestObject.data._id !== undefined) {
          user._id = modifiedData.requestObject.data._id;
        }

        return kuzzle.repositories.user.hydrate(user, modifiedData.requestObject.data.body);
      })
      .then(modifiedUser => kuzzle.repositories.user.persist(modifiedUser))
      .then(modifiedUser => formatProcessing.formatUserForSerialization(kuzzle, modifiedUser))
      .then(modifiedUser => kuzzle.pluginsManager.trigger('security:afterCreateOrReplaceUser', {
        responseObject: new ResponseObject(modifiedData.requestObject, modifiedUser),
        userContext: modifiedData.userContext
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

  return this.repositories.role.validateAndSaveRole(role, userContext, opts);
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
