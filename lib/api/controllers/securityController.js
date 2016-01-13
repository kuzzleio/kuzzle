var
  ResponseObject = require('../core/models/responseObject');

module.exports = function SecurityController (kuzzle) {

  /**
   * Get a specific role according to the given id
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.getRole = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:getRole', requestObject);

    return kuzzle.repositories.role.loadRole(
      kuzzle.repositories.role.getRoleFromRequestObject(requestObject)
      )
      .then(role => {
        return Promise.resolve(new ResponseObject(requestObject, role || {}));
      });
  };

  /**
   * Return a list of roles that specify a right for the given indexes
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.searchRoles = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:searchRole', requestObject);

    return kuzzle.repositories.role.searchRole(requestObject);
  };

  /**
   * Create or update a Role
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.putRole = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:putRole', requestObject);

    return kuzzle.repositories.role.validateAndSaveRole(
      kuzzle.repositories.role.getRoleFromRequestObject(requestObject)
      )
      .then(result => {
        return Promise.resolve(new ResponseObject(requestObject, result));
      });
  };

  /**
   * Remove a role according to the given id
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.deleteRole = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:deleteRole', requestObject);

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
      return Promise.reject(new BadRequestError('Missing profile id'));
    }

    return kuzzle.repositories.profile.loadProfile(requestObject.data._id)
      .then(profile => {
        return Promise.resolve(new ResponseObject(requestObject, profile || {}));
      });
  };

  /**
   * Create or update a Profile
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.putProfile = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:putProfile', requestObject);

    return kuzzle.repositories.profile.buildProfileFromRequestObject(requestObject)
      .then(profile => {
        return kuzzle.repositories.profile.hydrate(profile, requestObject.data.body);
      })
      .then(newProfile => {
        return kuzzle.repositories.profile.validateAndSaveProfile(newProfile);
      });
  };

  this.deleteProfile = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:deleteProfile', requestObject);

    return kuzzle.repositories.profile.buildProfileFromRequestObject(requestObject)
      .then(profile => {
        return kuzzle.repositories.profile.deleteProfile(profile)
      });
  };

  /**
   * Returns a list of profiles that contain a given set of roles
   * @param {RequestObject} requestObject
   * @returns {Promise}
   */
  this.searchProfiles = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:searchProfiles', requestObject);

    return kuzzle.repositories.profile.searchProfiles(requestObject);
  };
};
