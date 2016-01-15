var
  _ = require('lodash'),
  User = require('../core/models/security/user'),
  BadRequestError = require('../core/errors/badRequestError'),
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
      })
      .then(result => {
        return Promise.resolve(new ResponseObject(requestObject, result));
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
    kuzzle.pluginsManager.trigger('data:searchProfiles', requestObject);

    return kuzzle.repositories.profile.searchProfiles(requestObject);
  };

  this.getUser = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:getUser', requestObject);

    if (!requestObject.data._id) {
      return Promise.reject(new BadRequestError('No user id given'));
    }

    return kuzzle.repositories.user.load(requestObject.data._id)
      .then(user => {
        var response;

        if (!user) {
          return Promise.resolve(new ResponseObject(requestObject, {found: false}));
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

        return Promise.resolve(new ResponseObject(requestObject, response));
      });
  };

  this.getCurrentUser = function (requestObject, context) {
    requestObject.data._id = context.user._id;

    return this.getUser(requestObject);
  };

  this.searchUsers = function (requestObject) {
    var
      filter = {},
      from = 0,
      size = 20,
      hydrate = true;

    kuzzle.pluginsManager.trigger('data:searchUsers', requestObject);

    if (requestObject.data.body.filter !== undefined) {
      filter = requestObject.data.body.filter;
    }
    if (requestObject.data.body.from !== undefined) {
      from = requestObject.data.body.from;
    }
    if (requestObject.data.size !== undefined) {
      size = requestObject.data.body.size;
    }
    if (requestObject.data.body.hydrate !== undefined) {
      hydrate = requestObject.data.body.hydrate;
    }

    return kuzzle.repositories.user.search(filter, from, size, hydrate)
      .then(responseObject => {

        if (!responseObject.data.body || !responseObject.data.body.hits || !_.isArray(responseObject.data.body.hits)) {
          return Promise.resolve(responseObject);
        }

        responseObject.data.body.hits = responseObject.data.body.hits.map(user => {
          var doc = {
            _id: user._id,
            _source: user
          };
          delete doc._source._id;

          return doc;
        });

        return Promise.resolve(responseObject);
      });
  };

  this.deleteUser = function (requestObject) {
    kuzzle.pluginsManager.trigger('data:deleteUser', requestObject);

    if (!requestObject.data._id) {
      return Promise.reject(new BadRequestError('No user id given'));
    }

    return kuzzle.repositories.user.delete(requestObject.data._id)
      .then(() => {
        return new ResponseObject(requestObject, {});
      });
  };

  this.putUser = function (requestObject) {
    var
      user = new User();

    kuzzle.pluginsManager.trigger('data:putUser', requestObject);

    if (requestObject.data._id !== undefined) {
      user._id = requestObject.data._id;
    }

    if (!requestObject.data.body || !requestObject.data.body.profile) {
      return Promise.reject(new BadRequestError('Invalid user object. No profile property found.'));
    }

    return kuzzle.repositories.user.hydrate(user, requestObject.data.body)
      .then(user => {
        return kuzzle.repositories.user.persist(user)
          .then(response => {
            return new ResponseObject(requestObject, response);
          });
      });
  };

};
