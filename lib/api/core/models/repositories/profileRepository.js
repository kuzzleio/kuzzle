module.exports = function (kuzzle) {
  var
    _ = require('lodash'),
    q = require('q'),
    Profile = require('../security/profile'),
    BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
    ForbiddenError = require('kuzzle-common-objects').Errors.forbiddenError,
    NotFoundError = require('kuzzle-common-objects').Errors.notFoundError,
    Repository = require('./repository');

  var extractRoleIds = function (policies) {
    return policies.map(policy => {
      if (typeof policy === 'string') {
        return policy;
      }

      return policy._id;
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
   * @param {string} profileId
   * @returns {Promise} Resolves to the matching Profile object if found, null if not.
   */
  ProfileRepository.prototype.loadProfile = function (profileId) {
    if (!profileId) {
      return q.reject(new BadRequestError('Missing profileId'));
    }

    if (typeof profileId !== 'string') {
      return q.reject(new BadRequestError('A profileId must be provided'));
    }

    return this.load(profileId)
      .then(result => {
        if (result) {
          return result;
        }

        // no profile found
        return null;
      });
  };

  /**
   * Loads a Profile object given its id.
   *
   * @param {array} profilesId
   * @returns {Promise} Resolves to the matching Profile object if found, null if not.
   */
  ProfileRepository.prototype.loadProfiles = function (profilesIds) {
    var promises = [];
    
    if (!profilesIds) {
      return q.reject(new BadRequestError('Missing profilesIds'));
    }

    if (!_.isArray(profilesIds)) {
      return q.reject(new BadRequestError('An array of strings must be provided as profilesIds'));
    }

    if (profilesIds.length === 0) {
      return q([]);
    }

    profilesIds.forEach(profileId => {
      if (typeof profileId !== 'string') {
        return q.reject(new BadRequestError('An array of strings must be provided as profilesIds'));
      }

      promises.push(this.load(profileId));
    });

    return q.all(promises)
      .then(results => {
        var profiles = [];
        results.forEach(profile => {
          if (profile !== null) {
            this.profiles[profile._id] = profile;
            profiles.push(profile);
          }
        });
        return q(profiles);
      });
  };

  /**
   * Builds a Profile object from a RequestObject
   * @param {RequestObject} requestObject
   * @returns Promise Resolves to the built Profile object.
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
   * @returns {Promise}
   */
  ProfileRepository.prototype.searchProfiles = function (roles, from, offsetSize) {
    var filter = {};

    if (roles && Array.isArray(roles) && roles.length) {
      filter.or = [];
      roles.forEach(role => {
        filter.or.push({terms: { 'policies._id': [ role ] }});
      });
    }

    return this.search(filter, from, offsetSize);
  };

  /**
   * Populates a Profile object with the values contained in the data object.
   *
   * @param {Profile} profile
   * @param {Object} data
   * @returns Promise Resolves to the hydrated Profile object.
   */
  ProfileRepository.prototype.hydrate = function (profile, data) {
    var source;

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
    if (!profile.policies || profile.policies.length === 0) {
      profile.policies = [ {_id: 'default'} ];
    }

    _.assignIn(profile, data);

    return kuzzle.repositories.role.loadRoles(extractRoleIds(profile.policies))
      .then(roles => {
        var
          rolesNotFound = _.difference(extractRoleIds(profile.policies), extractRoleIds(roles));

        // Fail if not all roles are found
        if (rolesNotFound.length) {
          return q.reject(new NotFoundError(`Unable to hydrate the profile ${data._id}. The following roles don't exist: ${rolesNotFound}`));
        }

        return profile;
      });
  };

  /**
   * Given a Profile object, delete it from memory and database
   * @param {Profile} profile
   * @returns Promise
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
    // avoid the profile var mutation
    var result = _.assignIn({}, profile);

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