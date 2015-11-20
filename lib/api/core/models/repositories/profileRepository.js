module.exports = function (kuzzle) {
  var
    q = require('q'),
    Profile = require('../security/profile'),
    Repository = require('./repository');


  function ProfileRepository () {
    this.profiles = {};
  }

  ProfileRepository.prototype = new Repository(kuzzle, {
    collection: '§kuzzle/profiles',
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
   * Populates a Profile object with the values contained in the data object.
   *
   * @param {Profile} profile
   * @param {Object} data
   * @returns {Promise} Resolves to a *new* hydrated Profile object.
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


  return ProfileRepository;
};

