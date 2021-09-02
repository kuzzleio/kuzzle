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

const { omit } = require('lodash');
const Bluebird = require('bluebird');

const Profile = require('../../model/security/profile');
const Repository = require('../shared/repository');
const kerror = require('../../kerror');
const cacheDbEnum = require('../cache/cacheDbEnum');

/**
 * @class ProfileRepository
 * @extends Repository
 */
class ProfileRepository extends Repository {
  /**
   * @constructor
   */
  constructor (securityModule) {
    super({
      cache: cacheDbEnum.NONE,
      store: global.kuzzle.internalIndex,
    });

    this.module = securityModule;
    this.collection = 'profiles';
    this.ObjectConstructor = Profile;
    this.profiles = new Map();
  }

  init () {
    /**
     * Creates a new profile
     * @param  {String} id - profile identifier / name
     * @param  {Object} policies
     * @param  {Object} opts - refresh, userId (used for metadata)
     * @returns {Profile}
     * @throws If already exists or if the policies are invalid
     */
    global.kuzzle.onAsk(
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
    global.kuzzle.onAsk(
      'core:security:profile:createOrReplace',
      (id, policies, opts) => this.createOrReplace(id, policies, opts));

    /**
     * Deletes an existing profile
     * @param  {String} id
     * @param  {Object} opts - refresh
     * @throws If the profile doesn't exist, if it is protected, or if it's
     *         still in use
     */
    global.kuzzle.onAsk(
      'core:security:profile:delete',
      (id, opts) => this.deleteById(id, opts));

    /**
     * Loads and returns an existing profile
     * @param  {String} id - profile identifier
     * @returns {Profile}
     * @throws {NotFoundError} If the profile doesn't exist
     */
    global.kuzzle.onAsk('core:security:profile:get', id => this.load(id));

    /**
     * Invalidates the RAM cache from the given profile ID. If none is provided,
     * the entire cache is emptied.
     *
     * @param  {String} [id] - profile identifier
     */
    global.kuzzle.onAsk(
      'core:security:profile:invalidate',
      id => this.invalidate(id));

    /**
     * Gets multiple profiles
     * @param  {Array} ids
     * @returns {Array.<Profile>}
     * @throws If one or more profiles don't exist
     */
    global.kuzzle.onAsk(
      'core:security:profile:mGet',
      ids => this.loadProfiles(ids));

    /**
     * Fetches the next page of search results
     * @param  {String} id - scroll identifier
     * @param  {String} [ttl] - refresh the scroll results TTL
     * @returns {Object} Search results
     */
    global.kuzzle.onAsk(
      'core:security:profile:scroll',
      (id, ttl) => this.scroll(id, ttl));

    /**
     * Searches profiles
     *
     * @param  {Object} searchBody - Search query (ES format)
     * @param  {Object} opts (from, size, scroll)
     *
     * @returns {Object} Search results
     */
     global.kuzzle.onAsk(
      'core:security:profile:search',
      (searchBody, opts) => this.search(searchBody, opts));

    /**
     * Removes all existing profiles and invalidates the RAM cache
     * @param  {Object} opts (refresh)
     */
    global.kuzzle.onAsk(
      'core:security:profile:truncate',
      opts => this.truncate(opts));

    /**
     * Updates an existing profile using a partial content
     * @param  {String} id - profile identifier to update
     * @param  {Object} policies - partial policies to apply
     * @param  {Object} opts - refresh, retryOnConflict, userId (used for metadata)
     * @returns {Profile} Updated profile
     */
    global.kuzzle.onAsk(
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
    { method, refresh = 'false', strict, userId = null } = {}
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

    return this.validateAndSaveProfile(profile, { method, refresh, strict });
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
  async update (id, content, {refresh, retryOnConflict, strict, userId} = {}) {
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
      strict,
    });
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
  async delete (profile, {
    refresh = 'false',
    onAssignedUsers = 'fail',
    userId = '-1',
  } = {}) {
    if (['admin', 'default', 'anonymous'].includes(profile._id)) {
      throw kerror.get('security', 'profile', 'cannot_delete');
    }

    const query = {
      terms: {
        'profileIds': [ profile._id ]
      }
    };

    if (onAssignedUsers === 'remove') {
      const batch = [];
      let treated = 0;
      let userPage = await this.module.user.search(
        { query },
        { scroll: '1m', size: 100 });

      while (treated < userPage.total) {
        batch.length = 0;

        for (const user of userPage.hits) {
          user.profileIds = user.profileIds.filter(e => e !== profile._id);

          if (user.profileIds.length === 0) {
            user.profileIds.push('anonymous');
          }

          batch.push(this.module.user.update(
            user._id,
            user.profileIds,
            user,
            {
              refresh,
              userId
            }));
        }

        await Bluebird.all(batch);

        treated += userPage.hits.length;

        if (treated < userPage.total) {
          userPage = await this.module.user.scroll(userPage.scrollId, '1m');
        }
      }
    }
    else {
      const hits = await this.module.user.search({ query }, {from: 0, size: 1});

      if (hits.total > 0) {
        throw kerror.get('security', 'profile', 'in_use');
      }
    }

    await this.deleteFromDatabase(profile._id, {refresh});

    this.profiles.delete(profile._id);
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
    return omit(profile, ['_id']);
  }

  /**
   * Given a Profile object, validates its definition and if OK, persist it to the database.
   *
   * @param {Profile} profile
   * @param {Object} [options]
   * @param {string} [options.method] - Document persistence method
   * @param {string} [options.refresh] - (Don't) wait for index refresh
   * @param {number} [options.retryOnConflict] - Number of retries when an
   *                                             update fails due to a conflict
   * @param {boolean} [options.strict] - if true, restrictions can only be
   *                                     applied on existing indexes/collections
   * @returns {Promise<Profile>}
   **/
  async validateAndSaveProfile (profile, { method, refresh, retryOnConflict, strict } = {}) {
    const policiesRoles = profile.policies.map(p => p.roleId);

    // Assert: all roles must exist
    await this.module.role.loadRoles(policiesRoles);

    await profile.validateDefinition({ strict });

    if ( profile._id === 'anonymous'
      && policiesRoles.indexOf('anonymous') === -1
    ) {
      throw kerror.get('security', 'profile', 'missing_anonymous_role');
    }

    await this.persistToDatabase(profile, { method, refresh, retryOnConflict });

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
      profile.constructor._hash = obj => global.kuzzle.hash(obj);
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
