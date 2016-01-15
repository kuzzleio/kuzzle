module.exports = function (kuzzle) {
  var
    _ = require('lodash'),
    q = require('q'),
    Profile = require('../security/profile'),
    BadRequestError = require('../../errors/badRequestError'),
    Repository = require('./repository');

  var extractRoleIds = function (roles) {
    return roles.map(role => {
      return role._id;
    });
  };

  function ProfileRepository () {
    this.profiles = {};
  }

  ProfileRepository.prototype = new Repository(kuzzle, {
    index: '%kuzzle',
    collection: 'profiles',
    ObjectConstructor: Profile,
    cacheEngine: kuzzle.services.list.userCache
  });

  /**
   * Loads a Profile object given its id.
   *
   * @param profileKey
   * @returns {Promise} Resolves to the matching Profile object if found, null if not.
   */
  ProfileRepository.prototype.loadProfile = function (profileKey) {
    var
      deferred = q.defer();

    if (this.profiles[profileKey]) {
      deferred.resolve(this.profiles[profileKey]);
    }
    else {
      this.loadOneFromDatabase(profileKey)
        .then(function (result) {
          var
            data,
            p = new Profile();

          if (result) {
            // we got a profile from the database, we can use it
            deferred.resolve(result);
          }
          else if (kuzzle.config.defaultUserProfiles[profileKey]) {
            // no profile found in db but we have a default config for it
            data = kuzzle.config.defaultUserProfiles[profileKey];
            deferred.resolve(this.hydrate(p, data));
          }
          else {
            // no profile found
            deferred.resolve(null);
          }
        }.bind(this))
        .catch(function (error) {
          deferred.reject(error);
        });
    }

    return deferred.promise;
  };

  /**
   * Builds a Profile object from a RequestObject
   * @param {RequestObject} requestObject
   * @returns {Promise} Resolves to the built Profile object.
   */
  ProfileRepository.prototype.buildProfileFromRequestObject = function (requestObject) {
    var profile = new Profile();

    if (!requestObject.data._id) {
      return Promise.reject(new BadRequestError('Missing profile id'));
    }

    profile._id = requestObject.data._id;

    if (requestObject.data.body &&
        requestObject.data.body.roles &&
        requestObject.data.body.roles.length) {
      profile.roles = requestObject.data.body.roles;
    }

    return Promise.resolve(profile);
  };

  /**
   *
   * @param {RequestObject} requestObject
   */
  ProfileRepository.prototype.searchProfiles = function (requestObject) {
    var filter = {};
    requestObject.data.body = requestObject.data.body || {};

    if (requestObject.data.body.roles &&
        Array.isArray(requestObject.data.body.roles) &&
        requestObject.data.body.roles.length) {
      filter.or = [];
      requestObject.data.body.roles.forEach(role => {
        filter.or.push({terms: { 'roles': [ role ] }});
      });
    }

    return this.search(filter, requestObject.data.body.from, requestObject.data.body.size, requestObject.data.body.hydrate);
  };

  /**
   * Populates a Profile object with the values contained in the data object.
   *
   * @param {Profile} profile
   * @param {Object} data
   * @returns {Promise} Resolves to the hydrated Profile object.
   */
  ProfileRepository.prototype.hydrate = function (profile, data) {
    var
      deferred = q.defer(),
      o;

    Repository.prototype.hydrate.call(this, profile, data)
      .then(function (result) {
        o = result;
        return kuzzle.repositories.role.loadRoles(result.roles);
      })
      .then(function (roles) {
        // Fail if not all roles are found
        var rolesNotFound = _.difference(data.roles, extractRoleIds(roles));
        if (rolesNotFound.length) {
          throw new BadRequestError('Unable to hydrate profile with roles');
        }

        o.roles = roles;
        this.profiles[o._id] = o;

        deferred.resolve(o);
      }.bind(this))
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
  };

  /**
   * Given a Profile object, delete it from memory and database
   * @param {Profile} role
   * @returns {Promise}
   */
  ProfileRepository.prototype.deleteProfile = function (profile) {
    if (!profile._id) {
      return Promise.reject(new BadRequestError('Missing profile id'));
    }

    return this.deleteFromDatabase(profile._id)
      .then(response => {
        if (this.profiles[profile._id]) {
          delete this.profiles[profile._id];
        }

        return Promise.resolve(response);
      });
  };

  /**
   * From a Profile object, returns a serialized object ready to be persisted
   * to the database.
   *
   * @param {Profile} profile
   * @returns {Object}
   */
  ProfileRepository.prototype.serializeToDatabase = function (profile) {
    var result = {};

    Object.keys(profile).forEach(function (key) {
      if (key !== 'roles') {
        result[key] = profile[key];
      }
    });

    result.roles = extractRoleIds(profile.roles);

    return result;
  };

  /**
   * Given a Profile object, validates its definition and if OK, persist it to the database.
   * @param {Profile} role
   * @returns {Promise}
   */
  ProfileRepository.prototype.validateAndSaveProfile = function (profile) {
    var context = {
      connection: {type: 'websocket'},
      user: kuzzle.repositories.user.anonymous()
    };

    if (!profile._id) {
      return Promise.reject(new BadRequestError('Missing profile id'));
    }

    return profile.validateDefinition(context)
      .then(() => {
        this.profiles[profile._id] = profile;
        return this.persistToDatabase(profile);
      })
      .catch(error => {
        return Promise.reject(error);
      });
  };

  return ProfileRepository;
};
