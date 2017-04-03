'use strict';

const
  _ = require('lodash'),
  Promise = require('bluebird'),
  Profile = require('../security/profile'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  ForbiddenError = require('kuzzle-common-objects').errors.ForbiddenError,
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  Repository = require('./repository');

/**
 * @class ProfileRepository
 * @extends Repository
 */
class ProfileRepository extends Repository {
  /**
   * @params {Kuzzle} kuzzle
   * @constructor
   */
  constructor (kuzzle) {
    super(kuzzle);

    this.collection = 'profiles';
    this.ObjectConstructor = Profile;
    this.profiles = {};
  }

  init () {
    super.init({});
  }

  /**
   * Loads a Profile object given its id.
   *
   * @param {string} profileId
   * @returns {Promise} Resolves to the matching Profile object if found, null if not.
   */
  loadProfile (profileId) {
    if (!profileId) {
      return Promise.reject(new BadRequestError('Missing profileId'));
    }

    if (typeof profileId !== 'string') {
      return Promise.reject(new BadRequestError(`Invalid argument: Expected profile id to be a string, received "${typeof profileId}"`));
    }

    if (this.profiles[profileId]) {
      return Promise.resolve(this.profiles[profileId]);
    }

    return this.load(profileId)
      .then(result => {
        if (result) {
          this.profiles[profileId] = result;
          return result;
        }

        // no profile found
        return null;
      });
  }

  /**
   * Loads a Profile object given its id.
   *
   * @param {Array} profileIds - Array of profiles ids
   * @returns {Promise} Resolves to the matching Profile object if found, null if not.
   */
  loadProfiles (profileIds) {
    let promises;

    if (!profileIds) {
      return Promise.reject(new BadRequestError('Missing profileIds'));
    }

    if (!_.isArray(profileIds) || profileIds.reduce((prev, profile) => (prev || typeof profile !== 'string'), false)) {
      return Promise.reject(new BadRequestError('An array of strings must be provided as profileIds'));
    }

    if (profileIds.length === 0) {
      return Promise.resolve([]);
    }

    promises = profileIds.map(profileId => this.loadProfile(profileId));

    return Promise.all(promises)
      .then(results => {
        const profiles = [];
        results.forEach(profile => {
          if (profile !== null) {
            profiles.push(profile);
          }
        });

        return profiles;
      });
  }

  /**
   * Builds a Profile object from a Request
   *
   * @param {Request} request
   * @returns Promise Resolves to the built Profile object.
   */
  buildProfileFromRequest (request) {
    const profile = new Profile();

    if (request.input.body) {
      Object.assign(profile, request.input.body);
    }

    profile._id = request.input.resource._id;

    return Promise.resolve(profile);
  }

  /**
   *
   * @param {string[]} roles - array of role ids
   * @param {object} [options] - optional search arguments (from, size, scroll)
   * @returns {Promise}
   */
  searchProfiles (roles, options = {}) {
    const query = {query: {}};

    if (roles && Array.isArray(roles) && roles.length) {
      query.query = {terms: {'policies.roleId': roles}};
    }

    return this.search(query, options);
  }

  /**
   * Populates a Profile object with the values contained in the data object.
   *
   * @param {Profile} profile
   * @param {object} data
   * @returns {Promise<Profile>} Resolves to the hydrated Profile object.
   */
  hydrate (profile, data) {
    let source,
      policiesRoles;

    if (data._source) {
      source = data._source;
      delete data._index;
      delete data._type;
      delete data._version;
      delete data.found;
      delete data._source;
      Object.assign(data, source);
    }

    // force "default" role/policy if the profile does not have any role in it
    if (!profile.policies || profile.policies.length === 0) {
      profile.policies = [ {roleId: 'default'} ];
    }

    _.assignIn(profile, data);
    policiesRoles = extractRoleIds(profile.policies);

    return this.kuzzle.repositories.role.loadRoles(policiesRoles)
      .then(roles => {
        const rolesNotFound = _.difference(policiesRoles, extractRoleIds(roles));

        // Fail if not all roles are found
        if (rolesNotFound.length) {
          return Promise.reject(new NotFoundError(`Unable to hydrate the profile ${data._id}. The following role(s) don't exist: ${rolesNotFound}`));
        }

        return profile;
      });
  }

  /**
   * Given a Profile object, delete it from memory and database
   *
   * @param {Profile} profile
   * @returns {Promise}
   */
  deleteProfile (profile) {
    let query;

    if (!profile._id) {
      return Promise.reject(new BadRequestError('Missing profile id'));
    }

    if (['admin', 'default', 'anonymous'].indexOf(profile._id) > -1) {
      return Promise.reject(new BadRequestError(profile._id + ' is one of the basic profiles of Kuzzle, you cannot delete it, but you can edit it.'));
    }

    query = {terms: { 'profiles': [ profile._id ] }};

    return this.kuzzle.repositories.user.search(query, {from: 0, size: 1})
      .then(response => {
        if (response.total > 0) {
          return Promise.reject(new ForbiddenError('The profile "' + profile._id + '" cannot be deleted since it is used by some users.'));
        }

        return this.deleteFromCache(profile._id)
          .then(() => this.deleteFromDatabase(profile._id))
          .then((deleteResponse) => {
            if (this.profiles[profile._id] !== undefined) {
              delete this.profiles[profile._id];
            }

            this.kuzzle.pluginsManager.trigger('core:profileRepository:delete', {_id: profile._id});
            return deleteResponse;
          });

      });
  }

  /**
   * From a Profile object, returns a serialized object ready to be persisted
   * to the database.
   *
   * @param {Profile} profile
   * @returns {object}
   */
  serializeToDatabase (profile) {
    // avoid the profile var mutation
    const result = _.merge({}, profile);

    delete result._id;

    return result;
  }

  /**
   * Given a Profile object, validates its definition and if OK, persist it to the database.
   *
   * @param {Profile} profile
   * @param {object} [options] - The persistence options
   * @returns {Promise<Profile>}
   **/
  validateAndSaveProfile (profile, options) {
    if (!profile._id) {
      return Promise.reject(new BadRequestError('Missing profile id'));
    }

    return profile.validateDefinition()
      .then(() => {
        this.profiles[profile._id] = profile;
        this.kuzzle.pluginsManager.trigger('core:profileRepository:save', {_id: profile._id, policies: profile.policies});
        return this.persistToDatabase(profile, options);
      })
      .then(() => profile);
  }
}

module.exports = ProfileRepository;

/**
 * @param {object[]} policiesOrRoles
 */
function extractRoleIds(policiesOrRoles) {
  return policiesOrRoles.map(element => {
    if (element.roleId) {
      return element.roleId;
    }
    return element._id;
  });
}
