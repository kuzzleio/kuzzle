var
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
   * @returns {Promise}
   */
  this.createOrReplaceRole = function (requestObject) {
    kuzzle.pluginsManager.trigger('security:createOrReplaceRole', requestObject);

    return kuzzle.repositories.role.validateAndSaveRole(
      kuzzle.repositories.role.getRoleFromRequestObject(requestObject)
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
   * @returns {Promise}
   */
  this.createOrReplaceProfile = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:createOrReplaceProfile', requestObject);

    return kuzzle.repositories.profile.buildProfileFromRequestObject(requestObject)
      .then(profile => {
        return kuzzle.repositories.profile.hydrate(profile, requestObject.data.body);
      })
      .then(newProfile => {
        return kuzzle.repositories.profile.validateAndSaveProfile(newProfile);
      })
      .then(result => {
        return q(new ResponseObject(requestObject, result));
      });
  };

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
};
