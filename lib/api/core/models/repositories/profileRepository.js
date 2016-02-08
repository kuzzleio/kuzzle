module.exports = function (kuzzle) {
  var
    _ = require('lodash'),
    q = require('q'),
    Profile = require('../security/profile'),
    BadRequestError = require('../../errors/badRequestError'),
    NotFoundError = require('../../errors/notFoundError'),
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
    index: kuzzle.config.internalIndex,
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
        .then((result) => {
          var
            data,
            p = new Profile();

          if (result) {
            // we got a profile from the database, we can use it
            this.profiles[profileKey] = result;
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
        })
        .catch((error) => deferred.reject(error));
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
      return q.reject(new BadRequestError('Missing profile id'));
    }

    profile._id = requestObject.data._id;

    if (requestObject.data.body &&
        requestObject.data.body.roles &&
        requestObject.data.body.roles.length) {
      profile.roles = requestObject.data.body.roles;
    }

    return q(profile);
  };

  /**
   *
   * @param roles
   * @param from
   * @param offsetSize
   * @param hydrate
   * @returns {*}
   */
  ProfileRepository.prototype.searchProfiles = function (roles, from, offsetSize, hydrate) {
    var filter = {};

    if (roles && Array.isArray(roles) && roles.length) {
      filter.or = [];
      roles.forEach(role => {
        filter.or.push({terms: { 'roles': [ role ] }});
      });
    }

    return this.search(filter, from, offsetSize, hydrate);
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
          deferred.reject(new NotFoundError('Unable to hydrate profile with roles'));
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
   * @param {Profile} profile
   * @returns {Promise}
   */
  ProfileRepository.prototype.deleteProfile = function (profile) {
    if (!profile._id) {
      return q.reject(new BadRequestError('Missing profile id'));
    }

    return this.deleteFromDatabase(profile._id)
      .then(response => {
        if (this.profiles[profile._id]) {
          delete this.profiles[profile._id];
        }

        return response;
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

    delete result._id;

    return result;
  };

  /**
   * Given a Profile object, validates its definition and if OK, persist it to the database.
   * @param {Profile} profile
   * @param {object} context - user's context
   * @param {Object} opts The persistence options
   * @returns {Promise}
   */
  ProfileRepository.prototype.validateAndSaveProfile = function (profile, context, opts) {
    if (!profile._id) {
      return q.reject(new BadRequestError('Missing profile id'));
    }

    return profile.validateDefinition(context)
      .then(() => {
        this.profiles[profile._id] = profile;
        return this.persistToDatabase(profile, opts);
      })
      .catch(error => {
        return q.reject(error);
      });
  };

  return ProfileRepository;
};
