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
   * @returns {Promise}
   */
  this.getRole = function securityGetRole (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('security:beforeGetRole', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.repositories.role.loadRole(modifiedRequestObject.data._id);
      })
      .then(role => {
        if (!role) {
          return Promise.reject(new NotFoundError(`Role with id ${modifiedRequestObject.data._id} not found`));
        }

        return kuzzle.pluginsManager.trigger(
          'security:afterGetRole',
          new ResponseObject(modifiedRequestObject, formatProcessing.formatRoleForSerialization(role))
        );
      });
  };

  /**
   * Get specific roles according to given ids
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.mGetRoles = function securityMGetRoles (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('security:beforeMGetRoles', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        if (!modifiedRequestObject.data.body || !modifiedRequestObject.data.body.ids || !Array.isArray(modifiedRequestObject.data.body.ids)) {
          return Promise.reject(new BadRequestError('Missing role ids'));
        }

        return kuzzle.repositories.role.loadMultiFromDatabase(modifiedRequestObject.data.body.ids);
      })
      .then(roles => {
        roles = roles.map((role => {
          return formatProcessing.formatRoleForSerialization(role);
        }));

        return kuzzle.pluginsManager.trigger('security:afterMGetRoles', new ResponseObject(modifiedRequestObject, {hits: roles, total: roles.length}));
      });
  };

  /**
   * Return a list of roles that specify a right for the given indexes
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.searchRoles = function securitySearchRoles (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('security:beforeSearchRole', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.repositories.role.searchRole(modifiedRequestObject);
      })
      .then(response => {
        response.hits = response.hits.map((role => {
          return formatProcessing.formatRoleForSerialization(role);
        }));

        return response;
      })
      .then(response => kuzzle.pluginsManager.trigger('security:afterSearchRole', new ResponseObject(modifiedRequestObject, response)));
  };

  /**
   * Create or replace a Role
   * @param {RequestObject} requestObject
   * @param {PluginContext} context
   * @returns {Promise}
   */
  this.createOrReplaceRole = function securityCreateOrReplaceRole (requestObject, context) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('security:beforeCreateOrReplaceRole', {requestObject, context})
      .then(modifiedData => {
        modifiedRequestObject = modifiedData.requestObject;
        return createOrReplaceRole.call(kuzzle, modifiedRequestObject, modifiedData.context, {method: 'createOrReplace'});
      })
      .then(role => kuzzle.pluginsManager.trigger(
        'security:afterCreateOrReplaceRole',
        new ResponseObject(modifiedRequestObject, formatProcessing.formatRoleForSerialization(role))
      ));
  };

  /**
   * Create a Role
   *
   * @param {RequestObject} requestObject
   * @param {PluginContext} context
   * @returns {Promise}
   */
  this.createRole = function securityCreateRole (requestObject, context) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('security:beforeCreateRole', {requestObject, context})
      .then(modifiedData => {
        modifiedRequestObject = modifiedData.requestObject;
        return createOrReplaceRole.call(kuzzle, modifiedRequestObject, modifiedData.context, {method: 'create'});
      })
      .then(role => kuzzle.pluginsManager.trigger(
        'security:afterCreateRole',
        new ResponseObject(modifiedRequestObject, formatProcessing.formatRoleForSerialization(role))
      ));
  };

  /**
   * Remove a role according to the given id
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.deleteRole = function securityDeleteRole (requestObject) {
    var
      modifiedRequestObject = null,
      role;

    return kuzzle.pluginsManager.trigger('security:beforeDeleteRole', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        role = kuzzle.repositories.role.getRoleFromRequestObject(modifiedRequestObject);
        return kuzzle.repositories.role.deleteRole(role);
      })
      .then(response => kuzzle.pluginsManager.trigger('security:afterDeleteRole', new ResponseObject(modifiedRequestObject, response)));
  };

  /**
   * Get a specific profile according to the given id
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.getProfile = function securityGetProfile (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('security:beforeGetProfile', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        if (!modifiedRequestObject.data._id) {
          return Promise.reject(new BadRequestError('Missing profile id'));
        }

        return kuzzle.repositories.profile.loadProfile(modifiedRequestObject.data._id);
      })
      .then(profile => {
        if (!profile) {
          return Promise.reject(new NotFoundError(`Profile with id ${modifiedRequestObject.data._id} not found`));
        }

        return kuzzle.pluginsManager.trigger(
          'security:afterGetProfile',
          new ResponseObject(modifiedRequestObject, formatProcessing.formatProfileForSerialization(profile))
        );
      });
  };

  /**
   * Get specific profiles according to given ids
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.mGetProfiles = function securityMGetProfiles (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('security:beforeMGetProfiles', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        if (!modifiedRequestObject.data.body || !modifiedRequestObject.data.body.ids || !Array.isArray(modifiedRequestObject.data.body.ids)) {
          return Promise.reject(new BadRequestError('Missing profile ids'));
        }

        return kuzzle.repositories.profile.loadMultiFromDatabase(modifiedRequestObject.data.body.ids);
      })
      .then(profiles => {
        profiles = profiles.map(profile => formatProcessing.formatProfileForSerialization(profile));

        return kuzzle.pluginsManager.trigger('security:afterMGetProfiles', new ResponseObject(modifiedRequestObject, {hits: profiles, total: profiles.length}));
      });
  };

  /**
   * Create or replace a Profile
   * @param {RequestObject} requestObject
   * @param {PluginContext} context
   * @returns {Promise}
   */
  this.createOrReplaceProfile = function securityCreateOrReplaceProfile (requestObject, context) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('security:beforeCreateOrReplaceProfile', {requestObject, context})
      .then(modifiedData => {
        modifiedRequestObject = modifiedData.requestObject;

        return createOrReplaceProfile.call(kuzzle, modifiedRequestObject, modifiedData.context, {method: 'createOrReplace'});
      })
      .then(profile => kuzzle.pluginsManager.trigger(
        'security:afterCreateOrReplaceProfile',
        new ResponseObject(modifiedRequestObject, formatProcessing.formatProfileForSerialization(profile))
      ));

  };

  /**
   * Create a Profile
   * @param {RequestObject} requestObject
   * @param {PluginContext} context
   * @returns {Promise}
   */
  this.createProfile = function securityCreateProfile (requestObject, context) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('security:beforeCreateProfile', {requestObject, context})
      .then(modifiedData => {
        modifiedRequestObject = modifiedData.requestObject;
        return createOrReplaceProfile.call(kuzzle, modifiedRequestObject, modifiedData.context, {method: 'create'});
      })
      .then(profile => kuzzle.pluginsManager.trigger(
        'security:afterCreateProfile',
        new ResponseObject(modifiedRequestObject, formatProcessing.formatProfileForSerialization(profile))
      ));
  };

  /**
   * Deletes a profile
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.deleteProfile = function securityDeleteProfile (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('security:beforeDeleteProfile', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;
        return kuzzle.repositories.profile.buildProfileFromRequestObject(modifiedRequestObject);
      })
      .then(profile => kuzzle.repositories.profile.deleteProfile(profile))
      .then(response => kuzzle.pluginsManager.trigger('security:afterDeleteProfile', new ResponseObject(modifiedRequestObject, response)));
  };

  /**
   * Returns a list of profiles that contain a given set of roles
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.searchProfiles = function securitySearchProfiles (requestObject) {
    var
      roles = [],
      modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('security:beforeSearchProfiles', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        if (modifiedRequestObject.data.body && modifiedRequestObject.data.body.policies) {
          roles = modifiedRequestObject.data.body.policies;
        }

        return kuzzle.repositories.profile.searchProfiles(
          roles,
          modifiedRequestObject.data.body.from,
          modifiedRequestObject.data.body.size
        );
      })
      .then((response) => {
        response.hits = response.hits.map((profile) => {
          return formatProcessing.formatProfileForSerialization(profile);
        });

        return kuzzle.pluginsManager.trigger('security:afterSearchProfiles', new ResponseObject(modifiedRequestObject, response));
      });
  };

  /**
   * Given a user id, returns the matching User object
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.getUser = function securityGetUser (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('security:beforeGetUser', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        return kuzzle.repositories.user.load(modifiedRequestObject.data._id);
      })
      .then(user => {
        if (!user) {
          return Promise.reject(new NotFoundError(`User with id ${modifiedRequestObject.data._id} not found`));
        }

        return formatProcessing.formatUserForSerialization(kuzzle, user);
      })
      .then(response => kuzzle.pluginsManager.trigger('security:afterGetUser', new ResponseObject(modifiedRequestObject, response)));
  };

  /**
   * Given a profile id, returns the matching profile's rights as an array.
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.getProfileRights = function securityGetProfileRights (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('security:beforeGetProfileRights', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        if (!modifiedRequestObject.data._id) {
          return Promise.reject(new BadRequestError('No profile id given'));
        }

        return kuzzle.repositories.profile.loadProfile(modifiedRequestObject.data._id);
      })
      .then(profile => {
        if (!profile) {
          return Promise.reject(new NotFoundError(`Profile with id ${modifiedRequestObject.data._id} not found`));
        }

        return profile.getRights(kuzzle);
      })
      .then(rights => Promise.resolve(Object.keys(rights).reduce((array, item) => array.concat(rights[item]), [])))
      .then(rights => {
        var response = {
          hits: rights,
          total: rights.length
        };
        return kuzzle.pluginsManager.trigger('security:afterGetProfileRights', new ResponseObject(modifiedRequestObject, response));
      });
  };

  /**
   * Given a user id, returns the matching user's rights as an array.
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.getUserRights = function securityGetUserRights (requestObject) {
    var modifiedRequestObject = null;
    return kuzzle.pluginsManager.trigger('security:beforeGetUserRights', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        if (!modifiedRequestObject.data._id) {
          return Promise.reject(new BadRequestError('No user id given'));
        }

        return kuzzle.repositories.user.load(modifiedRequestObject.data._id);
      })
      .then(user => {
        if (!user) {
          return Promise.reject(new NotFoundError(`User with id ${modifiedRequestObject.data._id} not found`));
        }

        return user.getRights(kuzzle);
      })
      .then(rights => Object.keys(rights).reduce((array, item) => array.concat(rights[item]), []))
      .then(rights => {
        var response = {
          hits: rights,
          total: rights.length
        };
        return kuzzle.pluginsManager.trigger('security:afterGetUserRights', new ResponseObject(modifiedRequestObject, response));
      });
  };

  /**
   * Returns the User objects matching the given filters
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.searchUsers = function securitySearchUsers (requestObject) {
    var
      modifiedRequestObject = null,
      total;

    return kuzzle.pluginsManager.trigger('security:beforeSearchUsers', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        return kuzzle.repositories.user.search(
          modifiedRequestObject.data.body.filter || {},
          modifiedRequestObject.data.body.from,
          modifiedRequestObject.data.body.size
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
        return kuzzle.pluginsManager.trigger('security:afterSearchUsers',
          new ResponseObject(requestObject, {
            hits: formattedUsers,
            total: total
          })
        );
      });
  };

  /**
   * Deletes a User from Kuzzle
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.deleteUser = function securityDeleteUser (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('security:beforeDeleteUser', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        if (!modifiedRequestObject.data._id) {
          return Promise.reject(new BadRequestError('No user id given'));
        }

        return kuzzle.repositories.user.delete(modifiedRequestObject.data._id);
      })
      .then(() => kuzzle.pluginsManager.trigger('security:afterDeleteUser', new ResponseObject(modifiedRequestObject, { _id: modifiedRequestObject.data._id})));
  };

  /**
   * Creates a new User object in Kuzzle's database layer
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.createUser = function securityCreateUser (requestObject) {
    var
      user = new User(),
      modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('security:beforeCreateUser', requestObject)
      .then(newRequestObject => {
        var pojoUser;

        modifiedRequestObject = newRequestObject;

        if (!modifiedRequestObject.data.body || !modifiedRequestObject.data.body.profileIds) {
          return Promise.reject(new BadRequestError('Invalid user object. No profileIds property found.'));
        }

        pojoUser = modifiedRequestObject.data.body;

        if (modifiedRequestObject.data._id !== undefined) {
          pojoUser._id = modifiedRequestObject.data._id;
        }
        else {
          pojoUser._id = uuid.v4();
        }

        return kuzzle.repositories.user.hydrate(user, pojoUser);
      })
      .then(modifiedUser => kuzzle.repositories.user.persist(modifiedUser, { database: {method: 'create'} }))
      .then(modifiedUser => formatProcessing.formatUserForSerialization(kuzzle, modifiedUser))
      .then(serializedUser => kuzzle.pluginsManager.trigger('security:afterCreateUser', new ResponseObject(modifiedRequestObject, serializedUser)));
  };

  /**
   * Updates an existing User
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.updateUser = function securityUpdateUser (requestObject) {
    var modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('security:beforeUpdateUser', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        if (!modifiedRequestObject.data._id) {
          return Promise.reject(new BadRequestError('No user id given'));
        }

        if (modifiedRequestObject.data.body._id) {
          return Promise.reject(new BadRequestError('_id can not be part of the body'));
        }

        return kuzzle.repositories.user.load(modifiedRequestObject.data._id);
      })
      .then(user => kuzzle.repositories.user.persist(_.extend(user, modifiedRequestObject.data.body), { database: { method: 'update' } }))
      .then(updatedUser => formatProcessing.formatUserForSerialization(kuzzle, updatedUser))
      .then(serialized => kuzzle.pluginsManager.trigger('security:afterUpdateUser', new ResponseObject(modifiedRequestObject, serialized)));
  };

  /**
   * Updates an existing profile
   * @param {RequestObject} requestObject
   * @param {PluginContext} context
   * @returns {Promise}
   */
  this.updateProfile = function securityUpdateProfile (requestObject, context) {
    var
      modifiedRequestObject = null,
      modifiedContext;

    return kuzzle.pluginsManager.trigger('security:beforeUpdateProfile', {requestObject, context})
      .then(modifiedData => {
        modifiedRequestObject = modifiedData.requestObject;
        modifiedContext = modifiedData.context;

        if (!modifiedRequestObject.data._id) {
          return Promise.reject(new BadRequestError('No profile id given'));
        }

        if (modifiedRequestObject.data.body._id) {
          return Promise.reject(new BadRequestError('_id can not be part of the body'));
        }

        return kuzzle.repositories.profile.loadProfile(modifiedRequestObject.data._id);
      })
      .then(profile => kuzzle.repositories.profile.validateAndSaveProfile(_.extend(profile, modifiedRequestObject.data.body), modifiedContext, { method: 'update' }))
      .then(updatedProfile => {
        return kuzzle.pluginsManager.trigger('security:afterUpdateProfile',
          new ResponseObject(modifiedRequestObject, formatProcessing.formatProfileForSerialization(updatedProfile))
        );
      });
  };

  /**
   * Updates an existing role
   * @param {RequestObject} requestObject
   * @param {PluginContext} context
   * @returns {Promise}
   */
  this.updateRole = function securityUpdateRole (requestObject, context) {
    var
      modifiedRequestObject = null,
      modifiedContext;

    return kuzzle.pluginsManager.trigger('security:beforeUpdateRole', {requestObject, context})
      .then(modifiedData => {
        modifiedRequestObject = modifiedData.requestObject;
        modifiedContext = modifiedData.context;

        if (!modifiedRequestObject.data._id) {
          return Promise.reject(new BadRequestError('No role id given'));
        }

        if (modifiedRequestObject.data.body._id) {
          return Promise.reject(new BadRequestError('_id can not be part of the body'));
        }

        return kuzzle.repositories.role.loadRole(modifiedRequestObject.data._id);
      })
      .then(role => {
        if (!role) {
          return Promise.reject(new NotFoundError('Cannot update role "' + modifiedRequestObject.data._id + '": role not found'));
        }

        return kuzzle.repositories.role.validateAndSaveRole(_.extend(role, modifiedRequestObject.data.body), modifiedContext, { method: 'update' });
      })
      .then(updatedRole => kuzzle.pluginsManager.trigger(
        'security:afterUpdateRole',
        new ResponseObject(modifiedRequestObject, formatProcessing.formatRoleForSerialization(updatedRole))
      ));
  };

  /**
   * Creates or replaces a User in Kuzzle
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.createOrReplaceUser = function securityCreateOrReplaceUser (requestObject) {
    var
      user = new User(),
      modifiedRequestObject = null;

    return kuzzle.pluginsManager.trigger('security:beforeCreateOrReplaceUser', requestObject)
      .then(newRequestObject => {
        modifiedRequestObject = newRequestObject;

        if (!modifiedRequestObject.data.body || !modifiedRequestObject.data.body.profileIds) {
          return Promise.reject(new BadRequestError('Invalid user object. No profile property found.'));
        }

        if (modifiedRequestObject.data._id !== undefined) {
          user._id = modifiedRequestObject.data._id;
        }

        return kuzzle.repositories.user.hydrate(user, modifiedRequestObject.data.body);
      })
      .then(modifiedUser => kuzzle.repositories.user.persist(modifiedUser))
      .then(modifiedUser => formatProcessing.formatUserForSerialization(kuzzle, modifiedUser))
      .then(modifiedUser => kuzzle.pluginsManager.trigger('security:afterCreateOrReplaceUser', new ResponseObject(modifiedRequestObject, modifiedUser)));
  };
}

/**
 * @this Kuzzle
 * @param {RequestObject} requestObject
 * @param context
 * @param opts
 * @returns {Promise.<T>}
 */
function createOrReplaceRole (requestObject, context, opts) {
  var role = this.repositories.role.getRoleFromRequestObject(requestObject);

  return this.repositories.role.validateAndSaveRole(role, context, opts);
}

/**
 * @this Kuzzle
 * @param {RequestObject} requestObject
 * @param context
 * @param opts
 * @returns {Promise<Profile>}
 */
function createOrReplaceProfile (requestObject, context, opts) {
  if (!_.isArray(requestObject.data.body.policies)) {
    return Promise.reject(new BadRequestError('Policies property must be an array.'));
  }

  return this.repositories.profile.buildProfileFromRequestObject(requestObject)
    .then(profile => this.repositories.profile.hydrate(profile, requestObject.data.body))
    .then(hydratedProfile => this.repositories.profile.validateAndSaveProfile(hydratedProfile, context, opts));
}

module.exports = SecurityController;
