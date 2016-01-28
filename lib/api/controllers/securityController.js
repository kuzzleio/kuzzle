var
  _ = require('lodash'),
  User = require('../core/models/security/user'),
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
    var parsedProfile = {};

    parsedProfile._id = profile._id;
    if (!hydrate) {
      parsedProfile._source = {roles: profile.roles};
    } else {
      parsedProfile._source = {
        roles: profile.roles.map((role) => {
          return formatRoleForSerialization(role);
        })
      };
    }

    return parsedProfile;
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
   * Return a list of roles that specify a right for the given indexes
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.searchRoles = function (requestObject) {
    kuzzle.pluginsManager.trigger('security:searchRole', requestObject);

    return kuzzle.repositories.role.searchRole(requestObject)
      .then((response) => {
        if (requestObject.data.body.hydrate && response.data.body && response.data.body.hits) {
          response.data.body.hits = response.data.body.hits.map(role => {
            return formatRoleForSerialization(role);
          });
        }

        return q(response);
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
    kuzzle.pluginsManager.trigger('data:getProfile', requestObject);

    if (!requestObject.data._id) {
      return q.reject(new BadRequestError('Missing profile id'));
    }

    return kuzzle.repositories.profile.loadProfile(requestObject.data._id)
      .then(profile => {
        return q(new ResponseObject(requestObject, profile || {}));
      });
  };

  /**
   * Create or update a Profile
   * @param {RequestObject} requestObject
   * @param {PluginContext} context
   * @returns {Promise}
   */
  this.createOrReplaceProfile = function (requestObject, context) {
    kuzzle.pluginsManager.trigger('data:createOrReplaceProfile', requestObject);

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
    kuzzle.pluginsManager.trigger('data:deleteProfile', requestObject);

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

    kuzzle.pluginsManager.trigger('data:searchProfiles', requestObject);

    if (requestObject.data.body && requestObject.data.body.roles) {
      roles = requestObject.data.body.roles;
    }

    return kuzzle.repositories.profile.searchProfiles(
      roles,
      requestObject.data.body.from,
      requestObject.data.body.size,
      requestObject.data.body.hydrate
    ).then((response) => {
      if (response.data.body && response.data.body.hits) {
        response.data.body.hits = response.data.body.hits.map((profile) => {
          return formatProfileForSerialization(profile, requestObject.data.body.hydrate);
        });
      }

      return q(response);
    });
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
        var response;

        if (!user) {
          return q(new ResponseObject(requestObject, {found: false}));
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

        return q(new ResponseObject(requestObject, response));
      });
  };

  /**
   * Returns the user identified by the given jwt token
   * @param {RequestObject} requestObject
   * @param context
   * @returns {Promise}
   */
  this.getCurrentUser = function (requestObject, context) {
    requestObject.data._id = context.token.user._id;

    return this.getUser(requestObject);
  };

  /**
   * Returns the User objects matching the given filters
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.searchUsers = function (requestObject) {
    var
      filter = {},
      from = 0,
      size = 20,
      hydrate = true;

    kuzzle.pluginsManager.trigger('security:searchUsers', requestObject);

    if (requestObject.data.body.filter !== undefined) {
      filter = requestObject.data.body.filter;
    }
    if (requestObject.data.body.from !== undefined) {
      from = requestObject.data.body.from;
    }
    if (requestObject.data.body.size !== undefined) {
      size = requestObject.data.body.size;
    }
    if (requestObject.data.body.hydrate !== undefined) {
      hydrate = requestObject.data.body.hydrate;
    }

    if (!hydrate) {
      return kuzzle.repositories.user.search(filter, from, size, hydrate);
    }

    return kuzzle.repositories.user.search(filter, from, size, hydrate)
      .then(responseObject => {
        responseObject.data.body.hits = responseObject.data.body.hits.map(user => {
          var doc = {
            _id: user._id,
            _source: user
          };
          delete doc._source._id;

          return doc;
        });

        return q(responseObject);
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

  this.createUser = function (requestObject) {
    var user = new User();

    return kuzzle.pluginsManager.trigger('data:createUser', requestObject)
      .then(newRequestObject => {
        if (!newRequestObject.data.body || !newRequestObject.data.body.profile) {
          return q.reject(new BadRequestError('Invalid user object. No profile property found.'));
        }

        return kuzzle.repositories.user.hydrate(user, newRequestObject.data.body)
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
            return kuzzle.repositories.user.persist(_.extend(user, newRequestObject.data.body));
          });
      });

  };

  /**
   * Creates or updates a User in Kuzzle
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.putUser = function (requestObject) {
    var user = new User();

    return kuzzle.pluginsManager.trigger('security:putUser', requestObject)
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
