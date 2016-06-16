module.exports = function (kuzzle) {
  var
    _ = require('lodash'),
    q = require('q'),
    Profile = require('../security/profile'),
    BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
    ForbiddenError = require('kuzzle-common-objects').Errors.forbiddenError,
    NotFoundError = require('kuzzle-common-objects').Errors.notFoundError,
    Repository = require('./repository');

  var extractRoleIds = function (roles) {
    return roles.map(role => {
      if (typeof role === 'string') {
        return role;
      }

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
   * @param {Profile|string} profile
   * @returns {Promise} Resolves to the matching Profile object if found, null if not.
   */
  ProfileRepository.prototype.loadProfile = function (profile) {
    var
      profileId;

    if (profile instanceof Profile) {
      profileId = profile._id;
    }
    else if (typeof profile === 'string') {
      profileId = profile;
    }

    return this.load(profileId)
      .then((result) => {
        if (result) {
          return q(result);
        }

        // no profile found
        return q(null);
      });
  };

  /**
   * Builds a Profile object from a RequestObject
   * @param {RequestObject} requestObject
   * @returns Promise<T> Resolves to the built Profile object.
   */
  ProfileRepository.prototype.buildProfileFromRequestObject = function (requestObject) {
    var profile = new Profile();

    if (!requestObject.data._id) {
      return q.reject(new BadRequestError('Missing profile id'));
    }

    profile._id = requestObject.data._id;

    Object.keys(requestObject.data.body).forEach((key) => {
      if (key !== '_id') {
        profile[key] = requestObject.data.body[key];
      }
    });

    return q(profile);
  };

  /**
   *
   * @param roles array of role ids
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
        filter.or.push({terms: { 'roles._id': [ role ] }});
      });
    }

    return this.search(filter, from, offsetSize, hydrate);
  };

  /**
   * Populates a Profile object with the values contained in the data object.
   *
   * @param {Profile} profile
   * @param {Object} data
   * @returns Promise<T> Resolves to the hydrated Profile object.
   */
  ProfileRepository.prototype.hydrate = function (profile, data) {
    var
      source,
      deferred = q.defer(),
      o;

    if (data._source) {
      source = data._source;
      delete data._index;
      delete data._type;
      delete data._version;
      delete data.found;
      delete data._source;
      Object.assign(data, source);
    }

    // force "default" role if the profile does not have any role in it
    if (!profile.roles || profile.roles.length === 0) {
      profile.roles = [ {_id: 'default'} ];
    }

    Repository.prototype.hydrate.call(this, profile, data)
      .then(result => {
        o = result;
        return kuzzle.repositories.role.loadRoles(extractRoleIds(result.roles));
      })
      .then((roles) => {
        var
          clonedRoles = _.cloneDeep(roles),
          rolesNotFound = _.difference(extractRoleIds(o.roles), extractRoleIds(roles));

        // Fail if not all roles are found
        if (rolesNotFound.length) {
          deferred.reject(new NotFoundError(`Unable to hydrate the profile ${data._id}. The following roles don't exist: ${rolesNotFound}`));
          return deferred.promise;
        }

        clonedRoles.forEach(role => {
          o.roles.forEach(dataRole => {
            if (role._id === dataRole._id) {
              if (!_.isEmpty(dataRole.restrictedTo)) {
                role.restrictedTo = dataRole.restrictedTo;
              }
              if (dataRole.allowInternalIndex) {
                role.allowInternalIndex = dataRole.allowInternalIndex;
              }
            }
          });
        });

        o.roles = clonedRoles;

        deferred.resolve(o);
      })
      .catch(error => deferred.reject(error));

    return deferred.promise;
  };

  /**
   * Given a Profile object, delete it from memory and database
   * @param {Profile} profile
   * @returns Promise<T>
   */
  ProfileRepository.prototype.deleteProfile = function (profile) {
    var filter;

    if (!profile._id) {
      return q.reject(new BadRequestError('Missing profile id'));
    }

    if (['admin', 'default', 'anonymous'].indexOf(profile._id) > -1) {
      return q.reject(new BadRequestError(profile._id + ' is one of the basic profiles of Kuzzle, you cannot delete it, but you can edit it.'));
    }

    filter = {terms: { 'profiles': [ profile._id ] }};

    return kuzzle.repositories.user.search(filter, 0, 1, false)
      .then(response => {
        if (response.total > 0) {
          return q.reject(new ForbiddenError('The profile "' + profile._id + '" cannot be deleted since it is used by some users.'));
        }

        return this.deleteFromCache(profile._id)
          .then(() => this.deleteFromDatabase(profile._id));

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

    result.roles = [];
    profile.roles.forEach(role => {
      var serializedRole = {_id: role};
      if (_.isObject(role)) {
        serializedRole = {_id: role._id};
      }
      if (!_.isEmpty(role.restrictedTo)) {
        serializedRole.restrictedTo = role.restrictedTo;
      }
      if (role.allowInternalIndex) {
        serializedRole.allowInternalIndex = role.allowInternalIndex;
      }
      result.roles.push(serializedRole);
    });

    delete result._id;

    return result;
  };

  /**
   * Given a Profile object, validates its definition and if OK, persist it to the database.
   * @param {Profile} profile
   * @param {object} context - user's context
   * @param {Object} opts The persistence options
   * @returns Promise<Profile>
   **/
  ProfileRepository.prototype.validateAndSaveProfile = function (profile, context, opts) {
    if (!profile._id) {
      return q.reject(new BadRequestError('Missing profile id'));
    }

    return profile.validateDefinition()
      .then(() => {
        this.profiles[profile._id] = this.serializeToDatabase(profile);
        return this.persistToDatabase(profile, opts);
      })
      .then(() => this.hydrate(profile, this.profiles[profile._id]));
  };

  return ProfileRepository;
};