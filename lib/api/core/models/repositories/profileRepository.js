module.exports = function (kuzzle) {
  var
    q = require('q'),
    Profile = require('../security/profile'),
    Repository = require('./repository');


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

    if (!requestObject.data._id)
      return Promise.reject(new BadRequestError('Missing profile id'));

    if (requestObject.data._id) {
      profile._id = requestObject.data._id;
    }

    return this.hydrate(profile, requestObject.data.body);
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

    result.roles = profile.roles.map(function (role) {
      return role._id;
    });

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
      });
  };

  return ProfileRepository;
};
