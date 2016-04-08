var
  _ = require('lodash'),
  User = require('../core/models/security/user'),
  uuid = require('node-uuid'),
  q = require('q'),
  BadRequestError = require('../core/errors/badRequestError'),
  ResponseObject = require('../core/models/responseObject'),
  NotFoundError = require('../core/errors/notFoundError');

module.exports = function SecurityController (kuzzle) {
  var formatRoleForSerialization = function (role) {
    var response = {};

    response = {_id: role._id, _source: {}};
    Object.keys(role).forEach((key) => {
      if (key === 'closures') {
        return false;
      }
      else if (key !== '_id') {
        response._source[key] = role[key];
      }
    });

    return response;
  };

  var formatProfileForSerialization = function (profile, hydrate) {
    var response;

    if (! hydrate) {
      return profile;
    }

    response = {_id: profile._id, _source: {}};
    Object.keys(profile).forEach((key) => {
      if (key === 'roles') {
        response._source.roles = profile.roles.map((role) => {
          return formatRoleForSerialization(role);
        });
      }
      else if (key !== '_id') {
        response._source[key] = profile[key];
      }
    });

    return response;
  };

  var formatUserForSerialization = function (user, hydrate) {
    return kuzzle.pluginsManager.trigger('security:formatUserForSerialization', user)
      .then(triggeredUser => {
        var response = triggeredUser;

        if (hydrate) {
          response = {_id: triggeredUser._id, _source: {}};
          Object.keys(triggeredUser).forEach((key) => {
            if (key === 'profile') {
              response._source.profile = formatProfileForSerialization(triggeredUser.profile, hydrate);
            }
            else if (key !== '_id') {
              response._source[key] = triggeredUser[key];
            }
          });
        }
        return q(response);
      });
  };

  /**
   * Get a specific role according to the given id
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.getRole = function (requestObject) {
    var role = kuzzle.repositories.role.getRoleFromRequestObject(requestObject);

    kuzzle.pluginsManager.trigger('security:getRole', requestObject);

    return kuzzle.repositories.role.loadRole(role)
      .then(role => {
        if (!role) {
          return q.reject(new NotFoundError(`Role with id ${requestObject.data._id} not found`));
        }

        return q(new ResponseObject(requestObject, formatRoleForSerialization(role)));
      })
      .catch(err => new ResponseObject(requestObject, err));
  };

  /**
   * Get specific roles according to given ids
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.mGetRoles = function (requestObject) {
    kuzzle.pluginsManager.trigger('security:mGetRoles', requestObject);

    if (!requestObject.data.body || !requestObject.data.body.ids || !Array.isArray(requestObject.data.body.ids)) {
      return q.reject(new ResponseObject(requestObject, new BadRequestError('Missing role ids')));
    }

    return kuzzle.repositories.role.loadMultiFromDatabase(requestObject.data.body.ids, false)
      .then(roles => new ResponseObject(requestObject, {hits: roles, total: roles.length}))
      .catch(err => new ResponseObject(requestObject, err));
  };

  /**
   * Return a list of roles that specify a right for the given indexes
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.searchRoles = function (requestObject) {
    kuzzle.pluginsManager.trigger('security:searchRole', requestObject);

    return kuzzle.repositories.role.searchRole(requestObject)
      .then(response => new ResponseObject(requestObject, response))
      .catch(err => new ResponseObject(requestObject, err));
  };

  /**
   * Create or replace a Role
   * @param {RequestObject} requestObject
   * @param {PluginContext} context
   * @returns {Promise}
   */
  this.createOrReplaceRole = function (requestObject, context) {
    kuzzle.pluginsManager.trigger('security:createOrReplaceRole', requestObject);
    return createOrReplaceRole.call(kuzzle, requestObject, context, {method: 'createOrReplace'})
      .then(role => new ResponseObject(requestObject, formatRoleForSerialization(role, true)))
      .catch(err => new ResponseObject(requestObject, err));
  };

  /**
   * Create a Role
   *
   * @param {RequestObject} requestObject
   * @param {PluginContext} context
   * @returns {Promise}
   */
  this.createRole = function (requestObject, context) {
    kuzzle.pluginsManager.trigger('security:createRole', requestObject);
    return createOrReplaceRole.call(kuzzle, requestObject, context, {method: 'create'})
      .then(role => new ResponseObject(requestObject, formatRoleForSerialization(role, true)))
      .catch(err => new ResponseObject(requestObject, err));
  };

  /**
   * Remove a role according to the given id
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.deleteRole = function (requestObject) {
    var role = kuzzle.repositories.role.getRoleFromRequestObject(requestObject);

    kuzzle.pluginsManager.trigger('security:deleteRole', requestObject);

    return kuzzle.repositories.role.deleteRole(role)
      .then(response => new ResponseObject(requestObject, response))
      .catch(err => new ResponseObject(requestObject, err));
  };

  /**
   * Get a specific profile according to the given id
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.getProfile = function (requestObject) {
    kuzzle.pluginsManager.trigger('security:getProfile', requestObject);

    if (!requestObject.data._id) {
      return q.reject(new ResponseObject(requestObject, new BadRequestError('Missing profile id')));
    }

    return kuzzle.repositories.profile.buildProfileFromRequestObject(requestObject)
      .then(profile => kuzzle.repositories.profile.loadProfile(profile))
      .then(profile => {
        if (!profile) {
          return q.reject(new NotFoundError(`Profile with id ${requestObject.data._id} not found`));
        }

        return q(new ResponseObject(requestObject, formatProfileForSerialization(profile, true)));
      })
      .catch(err => new ResponseObject(requestObject, err));
  };

  /**
   * Get specific profiles according to given ids
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.mGetProfiles = function (requestObject) {
    kuzzle.pluginsManager.trigger('security:mGetProfiles', requestObject);

    if (!requestObject.data.body || !requestObject.data.body.ids || !Array.isArray(requestObject.data.body.ids)) {
      return q.reject(new ResponseObject(requestObject, new BadRequestError('Missing profile ids')));
    }

    return kuzzle.repositories.profile.loadMultiFromDatabase(requestObject.data.body.ids, requestObject.data.body.hydrate)
      .then(profiles => {
        profiles = profiles.map(profile => formatProfileForSerialization(profile, requestObject.data.body.hydrate));

        return new ResponseObject(requestObject, {hits: profiles, total: profiles.length});
      })
      .catch(err => new ResponseObject(requestObject, err));
  };

  /**
   * Create or replace a Profile
   * @param {RequestObject} requestObject
   * @param {PluginContext} context
   * @returns {Promise}
   */
  this.createOrReplaceProfile = function (requestObject, context) {
    kuzzle.pluginsManager.trigger('security:createOrReplaceProfile', requestObject);
    return createOrReplaceProfile.call(kuzzle, requestObject, context, {method: 'createOrReplace'})
      .then(profile => q(new ResponseObject(requestObject, formatProfileForSerialization(profile))))
      .catch(err => new ResponseObject(requestObject, err));
  };

  /**
   * Create a Profile
   * @param {RequestObject} requestObject
   * @param {PluginContext} context
   * @returns {Promise}
   */
  this.createProfile = function (requestObject, context) {
    kuzzle.pluginsManager.trigger('security:createProfile', requestObject);
    return createOrReplaceProfile.call(kuzzle, requestObject, context, {method: 'create'})
      .then(profile => q(new ResponseObject(requestObject, formatProfileForSerialization(profile))))
      .catch(err => new ResponseObject(requestObject, err));
  };

  /**
   * Deletes a profile
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.deleteProfile = function (requestObject) {
    kuzzle.pluginsManager.trigger('security:deleteProfile', requestObject);

    return kuzzle.repositories.profile.buildProfileFromRequestObject(requestObject)
      .then(profile => kuzzle.repositories.profile.deleteProfile(profile))
      .catch(err => new ResponseObject(requestObject, err));
  };

  /**
   * Returns a list of profiles that contain a given set of roles
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.searchProfiles = function (requestObject) {
    var roles = [];

    kuzzle.pluginsManager.trigger('security:searchProfiles', requestObject);

    if (requestObject.data.body && requestObject.data.body.roles) {
      roles = requestObject.data.body.roles;
    }

    return kuzzle.repositories.profile.searchProfiles(
      roles,
      requestObject.data.body.from,
      requestObject.data.body.size,
      requestObject.data.body.hydrate
    ).then((response) => {
      response.hits = response.hits.map((profile) => {
        return formatProfileForSerialization(profile, requestObject.data.body.hydrate);
      });

      return new ResponseObject(requestObject, response);
    })
    .catch(err => new ResponseObject(requestObject, err));
  };

  /**
   * Given a user id, returns the matching User object
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.getUser = function (requestObject) {
    kuzzle.pluginsManager.trigger('security:getUser', requestObject);

    if (!requestObject.data._id) {
      return q.reject(new BadRequestError('No user id given'));
    }

    return kuzzle.repositories.user.load(requestObject.data._id)
      .then(user => {
        if (!user) {
          return q.reject(new NotFoundError(`User with id ${requestObject.data._id} not found`));
        }

        return formatUserForSerialization(user, true);
      })
      .then(response => q(new ResponseObject(requestObject, response)));
  };

  /**
   * Returns the User objects matching the given filters
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.searchUsers = function (requestObject) {
    kuzzle.pluginsManager.trigger('security:searchUsers', requestObject);

    return kuzzle.repositories.user.search(
      requestObject.data.body.filter || {},
      requestObject.data.body.from,
      requestObject.data.body.size,
      requestObject.data.body.hydrate
    )
      .then(response => {
        var promises = response.hits.map((user => {
          return formatUserForSerialization(user, requestObject.data.body.hydrate);
        }));

        return q.all(promises).then(formattedUsers => {
          return q(new ResponseObject(requestObject, {hits: formattedUsers, total: formattedUsers.length}));
        });
      });
  };

  /**
   * Deletes a User from Kuzzle
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.deleteUser = function (requestObject) {
    kuzzle.pluginsManager.trigger('security:deleteUser', requestObject);

    if (!requestObject.data._id) {
      return q.reject(new BadRequestError('No user id given'));
    }

    return kuzzle.repositories.user.delete(requestObject.data._id)
      .then(() => new ResponseObject(requestObject, { _id: requestObject.data._id}));
  };

  /**
   * Creates a new User object in Kuzzle's database layer
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.createUser = function (requestObject) {
    var user = new User();

    return kuzzle.pluginsManager.trigger('security:createUser', requestObject)
      .then(newRequestObject => {
        var pojoUser;

        if (!newRequestObject.data.body || !newRequestObject.data.body.profile) {
          return q.reject(new BadRequestError('Invalid user object. No profile property found.'));
        }

        pojoUser = newRequestObject.data.body;

        if (newRequestObject.data._id !== undefined) {
          pojoUser._id = newRequestObject.data._id;
        }
        else {
          pojoUser._id = uuid.v4();
        }

        return kuzzle.repositories.user.hydrate(user, pojoUser)
          .then(u => {
            return kuzzle.repositories.user.persist(u, { database: {method: 'create'} });
          })
          .then(u => formatUserForSerialization(u, true))
          .then(serializedUser => new ResponseObject(requestObject, serializedUser));
      });

  };

  /**
   * Updates an existing User
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.updateUser = function (requestObject) {
    return kuzzle.pluginsManager.trigger('security:updateUser', requestObject)
      .then(newRequestObject => {
        if (!newRequestObject.data._id) {
          return q.reject(new BadRequestError('No user id given'));
        }

        return kuzzle.repositories.user.load(newRequestObject.data._id)
          .then(user => {
            return kuzzle.repositories.user.persist(_.extend(user, newRequestObject.data.body), { database: { method: 'update' } });
          })
          .then(updatedUser => formatUserForSerialization(updatedUser, true))
          .then(serialized => new ResponseObject(newRequestObject, serialized));
      });
  };

  /**
   * Updates an existing profile
   * @param {RequestObject} requestObject
   * @param {PluginContext} context
   * @returns {Promise}
   */
  this.updateProfile = function (requestObject, context) {
    var newRequestObject;

    return kuzzle.pluginsManager.trigger('security:updateProfile', requestObject)
      .then(rq => {
        if (!rq.data._id) {
          return q.reject(new BadRequestError('No profile id given'));
        }

        newRequestObject = rq;
        return kuzzle.repositories.profile.buildProfileFromRequestObject(newRequestObject);
      })
      .then(profile => kuzzle.repositories.profile.loadProfile(profile))
      .then(profile => kuzzle.repositories.profile.validateAndSaveProfile(_.extend(profile, newRequestObject.data.body), context, { method: 'update' }))
      .then(updatedProfile => q(new ResponseObject(newRequestObject, formatProfileForSerialization(updatedProfile, true))));
  };

  /**
   * Updates an existing role
   * @param {RequestObject} requestObject
   * @param {PluginContext} context
   * @returns {Promise}
   */
  this.updateRole = function (requestObject, context) {
    return kuzzle.pluginsManager.trigger('security:updateRole', requestObject)
      .then(newRequestObject => {
        if (!newRequestObject.data._id) {
          return q.reject(new BadRequestError('No role id given'));
        }

        return kuzzle.repositories.role.loadRole(
            kuzzle.repositories.role.getRoleFromRequestObject(requestObject)
          )
          .then(role => {
            if (!role) {
              return q.reject(new NotFoundError('Cannot update role "' + newRequestObject.data._id + '": role not found'));
            }

            return kuzzle.repositories.role.validateAndSaveRole(_.extend(role, newRequestObject.data.body), context, { method: 'update' });
          })
          .then(updatedRole => q(new ResponseObject(newRequestObject, formatRoleForSerialization(updatedRole))));
      });
  };

  /**
   * Creates or replaces a User in Kuzzle
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.createOrReplaceUser = function (requestObject) {
    var user = new User();
    return kuzzle.pluginsManager.trigger('security:createOrReplaceUser', requestObject)
      .then(newRequestObject => {
        if (!newRequestObject.data.body || !newRequestObject.data.body.profile) {
          return q.reject(new BadRequestError('Invalid user object. No profile property found.'));
        }

        if (newRequestObject.data._id !== undefined) {
          user._id = newRequestObject.data._id;
        }

        return kuzzle.repositories.user.hydrate(user, newRequestObject.data.body)
          .then(u => kuzzle.repositories.user.persist(u))
          .then(u => formatUserForSerialization(u, true))
          .then(u => new ResponseObject(newRequestObject, u));
      });
  };
};

function createOrReplaceRole (requestObject, context, opts) {
  var role = this.repositories.role.getRoleFromRequestObject(requestObject);

  return this.repositories.role.validateAndSaveRole(role, context, opts);
}

function createOrReplaceProfile (requestObject, context, opts) {
  if (!_.isArray(requestObject.data.body.roles)) {
    return q.reject(new BadRequestError('Roles property must be an array.'));
  }
  return this.repositories.profile.buildProfileFromRequestObject(requestObject)
    .then(profile => {
      return this.repositories.profile.hydrate(profile, requestObject.data.body);
    })
    .then(hydratedProfile => {
      return this.repositories.profile.validateAndSaveProfile(hydratedProfile, context, opts);
    });
}
