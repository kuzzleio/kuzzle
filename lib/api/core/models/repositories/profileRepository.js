/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const
  _ = require('lodash'),
  Bluebird = require('bluebird'),
  Profile = require('../security/profile'),
  Repository = require('./repository'),
  {
    BadRequestError,
    ForbiddenError,
    NotFoundError
  } = require('kuzzle-common-objects').errors;

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
    super.init({
      cacheEngine: null
    });
  }

  /**
   * Loads a Profile object given its id.
   *
   * @param {string} id
   * @returns {Promise} Resolves to the matching Profile object if found, null if not.
   */
  load (id) {
    if (!id) {
      return Bluebird.reject(new BadRequestError('Missing profileId'));
    }

    if (typeof id !== 'string') {
      return Bluebird.reject(new BadRequestError(`Invalid argument: Expected profile id to be a string, received "${typeof id}"`));
    }

    if (this.profiles[id]) {
      return Bluebird.resolve(this.profiles[id]);
    }

    return super.load(id)
      .then(profile => {
        if (profile) {
          this.profiles[id] = profile;
        }
        return profile;
      });
  }

  /**
   * Loads a Profile object given its id.
   * Stores the promise of the profile being loaded in the memcache
   * and then replaces it by the profile itself once it has been loaded
   *
   * This is to allow parallelisation while preventing sending requests
   * to ES, which is slow
   *
   * @param {Array} profileIds - Array of profiles ids
   * @returns {Promise} Resolves to the matching Profile object if found, null if not.
   */
  loadProfiles (profileIds) {
    if (!profileIds) {
      return Bluebird.reject(new BadRequestError('Missing profileIds'));
    }

    if (!Array.isArray(profileIds) || profileIds.some(p => typeof p !== 'string')) {
      return Bluebird.reject(new BadRequestError('An array of strings must be provided as profileIds'));
    }

    const profiles = [];

    for (const id of profileIds) {
      if (!this.profiles[id]) {
        this.profiles[id] = this.loadOneFromDatabase(id)
          .then(profile => {
            this.profiles[id] = profile;
            return profile;
          });
      }

      profiles.push(this.profiles[id]);
    }

    return Bluebird.all(profiles);
  }

  /**
   * Builds a Profile object from a Request
   *
   * @param {Request} request
   * @returns {Promise<Profile>}
   */
  buildProfileFromRequest (request) {
    const dto = {};

    if (request.input.body) {
      Object.assign(dto, request.input.body);
    }
    dto._id = request.input.resource._id;

    dto._kuzzle_info = {
      author: request.context.user ? String(request.context.user._id) : null,
      createdAt: Date.now(),
      updatedAt: null,
      updater: null
    };

    return this.fromDTO(dto);
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
    else {
      query.query = {match_all: {}};
    }

    return this.search(query, options);
  }

  /**
   * Given a Profile object, delete it from memory and database
   *
   * @param {Profile} profile
   * @param {object} [options]
   * @returns {Promise}
   */
  deleteProfile (profile, options = {}) {
    let query;

    if (!profile._id) {
      return Bluebird.reject(new BadRequestError('Missing profile id'));
    }

    if (['admin', 'default', 'anonymous'].indexOf(profile._id) > -1) {
      return Bluebird.reject(new BadRequestError(profile._id + ' is one of the basic profiles of Kuzzle, you cannot delete it, but you can edit it.'));
    }

    query = {
      terms: {
        'profiles': [ profile._id ]
      }
    };

    return this.kuzzle.repositories.user.search(query, {from: 0, size: 1})
      .then(response => {
        if (response.total > 0) {
          return Bluebird.reject(new ForbiddenError(`The profile "${profile._id}" cannot be deleted since it is used by some users.`));
        }

        return this.deleteFromDatabase(profile._id, options)
          .then(deleteResponse => {
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
    return  _.omit(profile, ['_id']);
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
      return Bluebird.reject(new BadRequestError('Missing profile id'));
    }

    return profile.validateDefinition()
      .then(() => {

        if (profile._id === 'anonymous'
          && profile.policies
            .map(policy => policy.roleId)
            .indexOf('anonymous') === -1) {
          throw new BadRequestError('Anonymous profile must include the anonymous role');
        }

        this.profiles[profile._id] = profile;
        this.kuzzle.pluginsManager.trigger('core:profileRepository:save', {_id: profile._id, policies: profile.policies});
        return this.persistToDatabase(profile, options);
      })
      .then(() => profile);
  }

  /**
   * @param {object} dto
   * @returns {Promise<Profile>}
   */
  fromDTO (dto) {
    return super.fromDTO(dto)
      .then(profile => {
        // force "default" role/policy if the profile does not have any role in it
        if (!profile.policies || profile.policies.length === 0) {
          profile.policies = [ {roleId: 'default'} ];
        }

        if (profile.constructor._hash('') === false) {
          profile.constructor._hash = this.kuzzle.constructor.hash;
        }

        const policiesRoles = profile.policies.map(p => p.roleId);

        return this.kuzzle.repositories.role.loadRoles(policiesRoles)
          .then(roles => {
            // Fail if not all roles are found
            if (roles.some(r => r === null)) {
              throw new NotFoundError(`Unable to hydrate the profile ${profile._id}: missing role(s) in the database`);
            }

            return profile;
          });
      });
  }
}


module.exports = ProfileRepository;
