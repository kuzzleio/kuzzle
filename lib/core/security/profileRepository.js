/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2020 Kuzzle
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

const _ = require('lodash');
const Bluebird = require('bluebird');

const Profile = require('../../model/security/profile');
const Repository = require('../shared/repository');
const kerror = require('../../kerror');

/**
 * @class ProfileRepository
 * @extends Repository
 */
class ProfileRepository extends Repository {
  /**
   * @params {Kuzzle} kuzzle
   * @constructor
   */
  constructor (kuzzle, securityModule) {
    super(kuzzle);
    this.module = securityModule;
    this.collection = 'profiles';
    this.ObjectConstructor = Profile;
    this.profiles = new Map();
  }

  init (options = {}) {
    super.init({
      cacheEngine: null,
      indexStorage: options.indexStorage
    });

    /**
     * Creates a new profile
     * @param  {String} id - profile identifier / name
     * @param  {Object} policies
     * @param  {Object} opts - refresh, userId (used for metadata)
     * @returns {Profile}
     * @throws If already exists or if the policies are invalid
     */
    this.kuzzle.onAsk(
      'core:security:profile:create',
      (id, policies, opts) => this.create(id, policies, opts));

    /**
     * Creates a new profile, or replaces it if it already exists
     * @param  {String} id
     * @param  {Object} policies
     * @param  {Object} opts - refresh, userId (used for metadata)
     * @returns {Profile}
     * @throws If the profile policies are invalid
     */
    this.kuzzle.onAsk(
      'core:security:profile:createOrReplace',
      (id, policies, opts) => this.createOrReplace(id, policies, opts));

    /**
     * Deletes an existing profile
     * @param  {String} id
     * @param  {Object} opts - refresh
     * @throws If the profile doesn't exist, if it is protected, or if it's
     *         still in use
     */
    this.kuzzle.onAsk(
      'core:security:profile:delete',
      (id, opts) => this.deleteById(id, opts));

    /**
     * Loads and returns an existing profile
     * @param  {String} id - profile identifier
     * @returns {Profile}
     * @throws {NotFoundError} If the profile doesn't exist
     */
    this.kuzzle.onAsk('core:security:profile:get', id => this.load(id));

    /**
     * Invalidates the RAM cache from the given profile ID. If none is provided,
     * the entire cache is emptied.
     *
     * @param  {String} [id] - profile identifier
     */
    this.kuzzle.onAsk(
      'core:security:profile:invalidate',
      id => this.invalidate(id));

    /**
     * Gets multiple profiles
     * @param  {Array} ids
     * @returns {Array.<Profile>}
     * @throws If one or more profiles don't exist
     */
    this.kuzzle.onAsk(
      'core:security:profile:mGet',
      ids => this.loadProfiles(ids));

    /**
     * Fetches the next page of search results
     * @param  {String} id - scroll identifier
     * @param  {String} [ttl] - refresh the scroll results TTL
     * @returns {Object} Search results
     */
    this.kuzzle.onAsk(
      'core:security:profile:scroll',
      (id, ttl) => this.scroll(id, ttl));

    /**
     * Searches profiles associated to a provided list of roles
     * @param  {Array.<String>} roles
     * @param  {Object} opts (from, size, scroll)
     * @returns {Object} Search results
     */
    this.kuzzle.onAsk(
      'core:security:profile:search',
      (roles, opts) => this.searchProfiles(roles, opts));

    /**
     * Removes all existing profiles and invalidates the RAM cache
     * @param  {Object} opts (refresh)
     */
    this.kuzzle.onAsk(
      'core:security:profile:truncate',
      opts => this.truncate(opts));

    /**
     * Updates an existing profile using a partial content
     * @param  {String} id - profile identifier to update
     * @param  {Object} policies - partial policies to apply
     * @param  {Object} opts - refresh, retryOnConflict, userId (used for metadata)
     * @returns {Profile} Updated profile
     */
    this.kuzzle.onAsk(
      'core:security:profile:update',
      (id, content, opts) => this.update(id, content, opts));
  }

  /**
   * Loads a Profile
   *
   * @param {string} id
   * @returns {Promise.<Promise>}
   * @throws {NotFoundError} If the corresponding profile doesn't exist
   */
  async load (id) {
    if (this.profiles.has(id)) {
      return this.profiles.get(id);
    }

    const profile = await super.load(id);

    this.profiles.set(id, profile);

    return profile;
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
   * @param {Object} options - resetCache (false)
   *
   * @returns {Promise} Resolves to the matching Profile object if found, null
   * if not.
   */
  async loadProfiles (profileIds = []) {
    const profiles = [];

    if (profileIds.some(p => typeof p !== 'string')) {
      throw kerror.get('api', 'assert', 'invalid_type', 'profileIds', 'string[]');
    }

    for (let i = 0; i < profileIds.length; i++) {
      const id = profileIds[i];
      let profile = this.profiles.get(id);

      if (!profile) {
        profile = this.loadOneFromDatabase(id)
          .then(p => {
            this.profiles.set(id, p);
            return p;
          });

        this.profiles.set(id, profile);
      }

      profiles.push(profile);
    }

    return Bluebird.all(profiles);
  }

  /**
   * @override
   */
  async loadOneFromDatabase (id) {
    try {
      return await super.loadOneFromDatabase(id);
    }
    catch(err) {
      if (err.status === 404) {
        throw kerror.get('security', 'profile', 'not_found', id);
      }
      throw err;
    }
  }

  /**
   * Creates a new profile, or create/replace a profile
   *
   * @param {String} id
   * @param {Object} policies
   * @param {Object} [opts]
   * @returns {Profile}
   */
  async _createOrReplace (
    id,
    content,
    { method, refresh = 'false', userId = null } = {}
  ) {
    const profile = await this.fromDTO({
      // content should be first: ignores _id and _kuzzle_info in it
      ...content,
      _id: id,
      _kuzzle_info: {
        author: userId,
        createdAt: Date.now(),
        updatedAt: null,
        updater: null,
      },
    });

    return this.validateAndSaveProfile(profile, {method, refresh});
  }

  /**
   * Creates a new profile
   *
   * @param {String} id
   * @param {Object} content
   * @param {Object} [opts]
   * @returns {Profile}
   */
  async create (id, content, opts) {
    return this._createOrReplace(id, content, {
      method: 'create',
      ...opts,
    });
  }

  /**
   * Creates or replaces a profile
   *
   * @param {String} id
   * @param {Object} content
   * @param {Object} [opts]
   * @returns {Profile}
   */
  async createOrReplace (id, content, opts) {
    return this._createOrReplace(id, content, {
      method: 'createOrReplace',
      ...opts,
    });
  }

  /**
   * Updates a profile
   * @param  {String} id
   * @param  {Object} content
   * @param  {Object} [opts]
   * @returns {Promise}
   */
  async update (id, content, {refresh, retryOnConflict, userId} = {}) {
    const profile = await this.load(id);
    const pojo = this.toDTO(profile);
    const updated = await this.fromDTO({
      // /!\ order is important
      ...pojo,
      ...content,
      // Always last, in case content contains these keys
      _id: id,
      _kuzzle_info: {
        updatedAt: Date.now(),
        updater: userId,
      },
    });

    return this.validateAndSaveProfile(updated, {
      method: 'update',
      refresh,
      retryOnConflict,
    });
  }

  /**
   *
   * @param {string[]} roles - array of role ids
   * @param {object} [options] - optional search arguments (from, size, scroll)
   * @returns {Promise}
   */
  searchProfiles (roles = [], {from=0, scroll, size=1000} = {}) {
    const query = {query: {}};

    if (roles && roles.length > 0) {
      query.query = {terms: {'policies.roleId': roles}};
    }
    else {
      query.query = {match_all: {}};
    }

    return this.search(query, {from, scroll, size});
  }

  /**
   * Deletes a profile
   *
   * @param {String} id
   * @param {object} [options]
   * @returns {Promise}
   */
  async deleteById (id, options) {
    const profile = await this.load(id);
    return this.delete(profile, options);
  }

  /**
   * @override
   */
  async delete (profile, {refresh = 'false'} = {}) {
    if (['admin', 'default', 'anonymous'].indexOf(profile._id) > -1) {
      throw kerror.get('security', 'profile', 'cannot_delete');
    }

    const query = {
      terms: {
        'profileIds': [ profile._id ]
      }
    };

    const hits = await this.module.user.search({ query }, {from: 0, size: 1});

    if (hits.total > 0) {
      throw kerror.get('security', 'profile', 'in_use');
    }

    await this.deleteFromDatabase(profile._id, {refresh});
    this.profiles.delete(profile._id);

    // @deprecated - used by the cluster
    this.kuzzle.emit('core:profileRepository:delete', {_id: profile._id});
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
    return _.omit(profile, ['_id']);
  }

  /**
   * Given a Profile object, validates its definition and if OK, persist it to the database.
   *
   * @param {Profile} profile
   * @param {object} [options] - The persistence options
   * @returns {Promise<Profile>}
   **/
  async validateAndSaveProfile (profile, options) {
    const policiesRoles = profile.policies.map(p => p.roleId);

    // Assert: all roles must exist
    await this.module.role.loadRoles(policiesRoles);

    await profile.validateDefinition();

    if ( profile._id === 'anonymous'
      && policiesRoles.indexOf('anonymous') === -1
    ) {
      throw kerror.get('security', 'profile', 'missing_anonymous_role');
    }

    this.kuzzle.emit('core:profileRepository:save', {
      _id: profile._id,
      policies: profile.policies
    });

    await this.persistToDatabase(profile, options);

    const updatedProfile = await this.loadOneFromDatabase(profile._id);

    this.profiles.set(profile._id, updatedProfile);
    return updatedProfile;
  }

  /**
   * @param {object} dto
   * @returns {Promise<Profile>}
   */
  async fromDTO (dto) {
    const profile = await super.fromDTO(dto);

    // force "default" role/policy if the profile does not have any role in it
    if (!profile.policies || profile.policies.length === 0) {
      profile.policies = [ {roleId: 'default'} ];
    }

    if (profile.constructor._hash('') === false) {
      profile.constructor._hash = this.kuzzle.constructor.hash;
    }

    const policiesRoles = profile.policies.map(p => p.roleId);
    const roles = await this.module.role.loadRoles(policiesRoles);

    // Fail if not all roles are found
    if (roles.some(r => r === null)) {
      throw kerror.get('security', 'profile', 'cannot_hydrate');
    }

    return profile;
  }

  /**
   * @override
   */
  async truncate (opts) {
    try {
      await super.truncate(opts);
    }
    finally {
      // always clear the RAM cache: even if truncate fails in the middle of it,
      // some of the cached profiles might not be valid anymore
      this.invalidate();
    }
  }

  /**
   * Invalidate the cache entries for the given profile. If none is provided,
   * the entire cache is emptied.
   * @param {string} [profileId]
   */
  invalidate (profileId) {
    if (!profileId) {
      this.profiles.clear();
    }
    else {
      this.profiles.delete(profileId);
    }
  }
}


module.exports = ProfileRepository;
