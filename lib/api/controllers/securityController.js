var
  _ = require('lodash'),
  User = require('../core/models/security/user'),
  uuid = require('node-uuid'),
  q = require('q'),
  BadRequestError = require('../core/errors/badRequestError'),
  ResponseObject = require('../core/models/responseObject');

module.exports = function SecurityController (kuzzle) {
  var formatRoleForSerialization = function (role) {
    var parsedRole = {};

    parsedRole._id = role._id;
    parsedRole._source = {indexes: role.indexes};

    return parsedRole;
  };

  var formatProfileForSerialization = function (profile, hydrate) {
    if (hydrate) {
      return {
        _id: profile._id,
        _source: {
          roles: profile.roles.map((role) => {
            return formatRoleForSerialization(role);
          })
        }
      };
    }

    return profile;
  };

  var formatUserForSerialization = function (user, hydrate) {
    if (hydrate) {
      return {
        _id: user._id,
        _source: {
          profile: formatProfileForSerialization(user.profile, true)
        }
      };
    }

    return user;
  };

  /**
   * Get a specific role according to the given id
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.getRole = function (requestObject) {
    kuzzle.pluginsManager.trigger('security:getRole', requestObject);

    return kuzzle.repositories.role.loadRole(
      kuzzle.repositories.role.getRoleFromRequestObject(requestObject)
      )
      .then(role => {
        if (role && role.closures) {
          delete role.closures;
        }

        return q(new ResponseObject(requestObject, role || {}));
      });
  };

  /**
   * Get specific roles according to given ids
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.mGetRoles = function (requestObject) {
    kuzzle.pluginsManager.trigger('security:mGetRoles', requestObject);

    if (!requestObject.data.body || !requestObject.data.body.ids || !Array.isArray(requestObject.data.body.ids)) {
      return q.reject(new BadRequestError('Missing role ids'));
    }

    return kuzzle.repositories.role.loadMultiFromDatabase(requestObject.data.body.ids, false)
      .then(roles => {
        return new ResponseObject(requestObject, {hits: roles, total: roles.length});
      });
  };

  /**
   * Return a list of roles that specify a right for the given indexes
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.searchRoles = function (requestObject) {
    kuzzle.pluginsManager.trigger('security:searchRole', requestObject);

    return kuzzle.repositories.role.searchRole(requestObject)
      .then((roles) => {
        return new ResponseObject(requestObject, {hits: roles, total: roles.length});
      });
  };

  /**
   * Create or replace a Role
   * @param {RequestObject} requestObject
   * @param {PluginContext} context
   * @returns {Promise}
   */
  this.createOrReplaceRole = function (requestObject, context) {
    kuzzle.pluginsManager.trigger('security:createOrReplaceRole', requestObject);

    return kuzzle.repositories.role.validateAndSaveRole(
      kuzzle.repositories.role.getRoleFromRequestObject(requestObject), context
      )
      .then(result => {
        return q(new ResponseObject(requestObject, result));
      });
  };

  /**
   * Remove a role according to the given id
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.deleteRole = function (requestObject) {
    kuzzle.pluginsManager.trigger('security:deleteRole', requestObject);

    return kuzzle.repositories.role.deleteRole(
      kuzzle.repositories.role.getRoleFromRequestObject(requestObject)
    );
  };

  /**
   * Get a specific profile according to the given id
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.getProfile = function (requestObject) {
    kuzzle.pluginsManager.trigger('security:getProfile', requestObject);

    if (!requestObject.data._id) {
      return q.reject(new BadRequestError('Missing profile id'));
    }

    return kuzzle.repositories.profile.loadProfile(requestObject.data._id)
      .then(profile => {
        return q(new ResponseObject(requestObject, profile || {}));
      });
  };

  /**
   * Get specific profiles according to given ids
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.mGetProfiles = function (requestObject) {
    kuzzle.pluginsManager.trigger('security:mGetProfiles', requestObject);

    if (!requestObject.data.body || !requestObject.data.body.ids || !Array.isArray(requestObject.data.body.ids)) {
      return q.reject(new BadRequestError('Missing profile ids'));
    }

    return kuzzle.repositories.profile.loadMultiFromDatabase(requestObject.data.body.ids, requestObject.data.body.hydrate)
      .then(profiles => {
        profiles = profiles.map((profile) => {
          return formatProfileForSerialization(profile, requestObject.data.body.hydrate);
        });

        return new ResponseObject(requestObject, {hits: profiles, total: profiles.length});
      });
  };

  /**
   * Create or update a Profile
   * @param {RequestObject} requestObject
   * @param {PluginContext} context
   * @returns {Promise}
   */
  this.createOrReplaceProfile = function (requestObject, context) {
    kuzzle.pluginsManager.trigger('security:createOrReplaceProfile', requestObject);

    return kuzzle.repositories.profile.buildProfileFromRequestObject(requestObject)
      .then(profile => {
        return kuzzle.repositories.profile.hydrate(profile, requestObject.data.body);
      })
      .then(newProfile => {
        return kuzzle.repositories.profile.validateAndSaveProfile(newProfile, context);
      })
      .then(result => {
        return q(new ResponseObject(requestObject, result));
      });
  };

  /**
   * Deletes a profile
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.deleteProfile = function (requestObject) {
    kuzzle.pluginsManager.trigger('security:deleteProfile', requestObject);

    return kuzzle.repositories.profile.buildProfileFromRequestObject(requestObject)
      .then(profile => {
        return kuzzle.repositories.profile.deleteProfile(profile);
      });
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
    ).then((profiles) => {

      profiles = profiles.map((profile) => {
        return formatProfileForSerialization(profile, requestObject.data.body.hydrate);
      });

      return new ResponseObject(requestObject, {hits: profiles, total: profiles.length});
    });
  };

  /**
   * Given a user id, returns the matching User object
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.getUser = function (requestObject) {
    if (!requestObject.data._id) {
      return q.reject(new BadRequestError('No user id given'));
    }

    return kuzzle.repositories.user.load(requestObject.data._id)
      .then(user => {
        var response;

        if (!user) {
          return q({found: false});
        }

        if (requestObject.data.body.hydrate !== undefined && requestObject.data.body.hydrate === false) {
          response = {
            _id: user._id,
            _source: kuzzle.repositories.user.serializeToDatabase(user)
          };
        }
        else {
          response = {
            _id: user._id,
            _source: user
          };
        }
        delete response._source._id;

        return kuzzle.pluginsManager.trigger('security:getUser', response);
      })
      .then(response => {
        return q(new ResponseObject(requestObject, response));
      });
  };

  /**
   * Returns the User objects matching the given filters
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.searchUsers = function (requestObject) {
    return kuzzle.repositories.user.search(
      requestObject.data.body.filter || {},
      requestObject.data.body.from,
      requestObject.data.body.size,
      requestObject.data.body.hydrate
    )
      .then(users => {
        users = users.map((user) => {
          return formatUserForSerialization(user, requestObject.data.body.hydrate);
        });

        return kuzzle.pluginsManager.trigger('security:searchUsers', users);
      })
      .then(users => {
        return new ResponseObject(requestObject, {hits: users, total: users.length});
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
      .then(() => {
        return new ResponseObject(requestObject, {});
      });
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
          });
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
          });
      });

  };

  /**
   * Creates or updates a User in Kuzzle
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.createOrReplaceUser = function (requestObject) {
    var user = new User();

    return kuzzle.pluginsManager.trigger('security:createOrReplaceUser', requestObject)
      .then(newRequestObject => {
        if (newRequestObject.data._id !== undefined) {
          user._id = newRequestObject.data._id;
        }

        if (!newRequestObject.data.body || !newRequestObject.data.body.profile) {
          return q.reject(new BadRequestError('Invalid user object. No profile property found.'));
        }

        return kuzzle.repositories.user.hydrate(user, newRequestObject.data.body)
          .then(u => {
            return kuzzle.repositories.user.persist(u);
          })
          .then(response => {
            return new ResponseObject(newRequestObject, response);
          });
      });

  };

};
