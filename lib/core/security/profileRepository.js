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
const Profile = require('../../models/security/profile');
const Repository = require('../shared/repository');
const errorsManager = require('../../util/errors');

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

    // Events registration
    this.kuzzle.onAsk(
      'core:security:profiles:create',
      (id, content, opts) => this.create(id, content, opts));
    this.kuzzle.onAsk(
      'core:security:profiles:createOrReplace',
      (id, content, opts) => this.createOrReplace(id, content, opts));
    this.kuzzle.onAsk(
      'core:security:profiles:delete',
      (id, opts) => this.delete(id, opts));
    this.kuzzle.onAsk('core:security:profiles:get', id => this.load(id));
    this.kuzzle.onAsk(
      'core:security:profiles:mGet',
      ids => this.loadProfiles(ids));
    this.kuzzle.onAsk(
      'core:security:profiles:scroll',
      (id, scroll) => this.scroll(id, scroll));
    this.kuzzle.onAsk(
      'core:security:profiles:search',
      (query, opts) => this.searchProfiles(query, opts));
    this.kuzzle.onAsk(
      'core:security:profiles:truncate',
      opts => this.truncate(opts));
    this.kuzzle.onAsk(
      'core:security:profiles:update',
      (id, content, opts) => this.update(id, content, opts));

    // Clear cache upon an admin:resetSecurity API call (successful or not)
    this.kuzzle.onPipe('admin:afterResetSecurity', this.clearCache.bind(this));
    this.kuzzle.onPipe('admin:errorResetSecurity', this.clearCache.bind(this));
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
  async loadProfiles (profileIds) {
    const profiles = [];

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
        throw errorsManager.get('security', 'profile', 'not_found', id);
      }
      throw err;
    }
  }

  /**
   * Creates a new role, or create/replace a profile
   *
   * @param {String} id
   * @param {Object} content
   * @param {Object} [opts]
   * @returns {Role}
   */
  async _createOrReplace (
    id,
    content,
    { method, refresh = null, userId = null } = {}
  ) {
    const profile = await this.fromDTO({
      _id: id,
      _kuzzle_info: {
        author: userId,
        createdAt: Date.now(),
        updatedAt: null,
        updater: null,
      },
      ...content,
    });

    return this.validateAndSaveProfile(profile, {method, refresh});
  }

  /**
   * Creates a new profile
   *
   * @param {String} id
   * @param {Object} content
   * @param {Object} [opts]
   * @returns {Role}
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
   * @returns {Role}
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
   * @return {Promise}
   */
  async update (id, content, {refresh, retryOnConflict, userId} = {}) {
    const profile = await this.load(id);
    const pojo = this.toDTO(profile);
    const updated = await this.fromDTO({
      _id: id,
      _kuzzle_info: {
        updatedAt: Date.now(),
        updater: userId,
      },
      // /!\ order is important
      ...pojo,
      ...content,
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
  searchProfiles (roles = [], {from=0, scroll=null, size=1000} = {}) {
    const query = {query: {}};

    if (roles.length > 0) {
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
  async delete (id, {refresh = null} = {}) {
    if (['admin', 'default', 'anonymous'].indexOf(id) > -1) {
      throw errorsManager.get('security', 'profile', 'cannot_delete');
    }

    // Assertion: the profile must exist
    await this.load(id);

    const query = {
      terms: {
        'profileIds': [ id ]
      }
    };

    const hits = await this.module.users.search({ query }, {from: 0, size: 1});

    if (hits.total > 0) {
      throw errorsManager.get('security', 'profile', 'in_use');
    }

    await this.deleteFromDatabase(id, {refresh});
    this.profiles.delete(id);

    // @deprecated - used by the cluster
    this.kuzzle.emit('core:profileRepository:delete', {_id: id});
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

    try {
      await this.module.roles.loadRoles(policiesRoles);
    }
    catch (nil) {
      throw errorsManager.get('security', 'profile', 'cannot_hydrate', profile._id);
    }

    await profile.validateDefinition();

    if ( profile._id === 'anonymous'
      && policiesRoles.indexOf('anonymous') === -1
    ) {
      throw errorsManager.get('security', 'profile', 'missing_anonymous_role');
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
    const roles = await this.module.roles.loadRoles(policiesRoles);

    // Fail if not all roles are found
    if (roles.some(r => r === null)) {
      throw errorsManager.get('security', 'profile', 'cannot_hydrate');
    }

    return profile;
  }

  /**
   * Clears all profiles stored in cache, forcing to reload from the database
   * next time profiles are requested.
   */
  clearCache () {
    this.profiles.clear();
  }
}


module.exports = ProfileRepository;
