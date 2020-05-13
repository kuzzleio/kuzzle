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

const debug = require('../../util/debug')('kuzzle:core:security:users');
const {v4: uuid} = require('uuid');
const Repository = require('../shared/repository');
const kerror = require('../../kerror');
const User = require('../../model/security/user');
const ApiKey = require('../../model/storage/apiKey');
const { Request } = require('kuzzle-common-objects');

/**
 * @class UserRepository
 * @extends Repository
 */
class UserRepository extends Repository {
  /**
   * @param {Kuzzle} kuzzle
   * @param {SecurityModule} securityModule
   * @constructor
   */
  constructor (kuzzle, securityModule) {
    super(kuzzle);
    this.module = securityModule;
    this.collection = 'users';
    this.ObjectConstructor = User;
    this.anonymousUser = null;
  }

  async init (options = {}) {
    super.init({ indexStorage: options.indexStorage });

    this.anonymousUser = await this.fromDTO({
      _id: '-1',
      name: 'Anonymous',
      profileIds: ['anonymous']
    });

    // Events registration
    this.kuzzle.onAsk('core:security:users:anonymous', () => this.anonymousUser);
    this.kuzzle.onAsk(
      'core:security:users:create',
      (id, profileIds, content, opts) => this.create(id, profileIds, content, opts));
    this.kuzzle.onAsk(
      'core:security:users:delete',
      (id, opts) => this.delete(id, opts));
    this.kuzzle.onAsk('core:security:users:get', id => this.load(id));
    this.kuzzle.onAsk(
      'core:security:users:mGet',
      ids => this.loadMultiFromDatabase(ids));
    this.kuzzle.onAsk(
      'core:security:users:replace',
      (id, content, opts) => this.replace(id, content, opts));
    this.kuzzle.onAsk(
      'core:security:users:scroll',
      (id, scroll) => this.scroll(id, scroll));
    this.kuzzle.onAsk(
      'core:security:users:search',
      (query, opts) => this.search(query, opts));
    this.kuzzle.onAsk(
      'core:security:users:truncate',
      opts => this.truncate(opts));
    this.kuzzle.onAsk(
      'core:security:users:update',
      (id, content, opts) => this.update(id, content, opts));
  }

  /**
   * Creates a user
   * @param {String} id
   * @param {Array} profileIds - profiles to associate to this user
   * @param {Object} content
   * @param {Object} [opts]
   */
  async create (id, profileIds, content, {userId, refresh = null} = {}) {
    try {
      await this.load(id);
      throw kerror.get('security', 'user', 'already_exists', id);
    }
    catch (error) {
      if (error.id !== 'services.storage.not_found') {
        throw error;
      }
    }

    const user = await this.fromDTO({
      _id: id,
      _kuzzle_info: {
        author: userId,
        createdAt: Date.now(),
        updatedAt: null,
        updater: null,
      },
      // Profile Ids and content are stored at the same level... for now.
      profileIds,
      ...content,
    });

    return this.persist(user, {
      database: { method: 'create', refresh }
    });
  }

  /**
   * Updates a user's content
   * @param  {String} id
   * @param  {Object} content
   * @param  {Object} [opts]
   * @return {Promise}
   */
  async update (id, content, {refresh, retryOnConflict, userId} = {}) {
    const user = await this.load(id);
    const pojo = this.toDTO(user);
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

    return this.persist(updated, {
      database: {
        method: 'update',
        refresh,
        retryOnConflict,
      }
    });
  }

  /**
   * Replaces a user's content
   * @param  {String} id
   * @param  {Object} content
   * @param  {Object} [opts]
   * @return {Promise}
   */
  async replace (id, content, {refresh, userId} = {}) {
    // Assertion: the user must exist
    await this.load(id);

    const user = await this.fromDTO({
      _id: id,
      _kuzzle_info: {
        author: userId,
        createdAt: Date.now(),
        updatedAt: null,
        updater: null
      },
      ...content,
    });

    return this.persist(user, {
      database: {
        method: 'replace',
        refresh
      }
    });
  }

  /**
   * Loads a user
   *
   * @param {string} id
   * @return {Promise.<User>}
   * @throws {NotFonudError} If the user is not found
   */
  async load (id) {
    if (id === 'anonymous' || id === '-1') {
      return this.anonymousUser;
    }

    const user = await super.load(id);

    return user;
  }

  async persist (user, options = {}) {
    const databaseOptions = options.database || {};
    const cacheOptions = options.cache || {};

    if (user._id === undefined || user._id === null) {
      user._id = uuid();
    }

    if ( user._id === this.anonymousUser._id
      && user.profileIds.indexOf('anonymous') === -1
    ) {
      throw kerror.get('security', 'user', 'anonymous_profile_required');
    }

    await this.persistToDatabase(user, databaseOptions);
    await this.persistToCache(user, cacheOptions);

    return user;
  }

  /**
   * @param dto
   * @returns {Promise<User>}
   */
  async fromDTO (dto) {
    if (dto.profileIds && !Array.isArray(dto.profileIds)) {
      dto.profileIds = [dto.profileIds];
    }

    const user = await super.fromDTO(dto);

    if (user._id === undefined || user._id === null) {
      return this.anonymousUser;
    }

    // if the user exists (has an _id) but no profile associated: there is a
    // database inconsistency
    if (user.profileIds.length === 0) {
      throw kerror.get('security, user', 'no_profile', user._id);
    }

    const profiles = await this.module.profiles.loadProfiles(user.profileIds);

    // Fail if not all profiles are found
    if (profiles.some(p => p === null)) {
      throw kerror.get('security', 'user', 'cannot_hydrate', dto._id);
    }

    return user;
  }

  /**
   * Deletes a user from memory and database, along with its related tokens and
   * strategies.
   *
   * @param {String} id
   * @param {Object} [options]
   * @returns {Promise}
   */
  async delete (id, {refresh = null} = {}) {
    debug('Delete user: %s', id);

    const user = await this.load(id);

    await super.delete(user, {refresh});
    await this._removeUserStrategies(user);
    await ApiKey.deleteByUser(user, {refresh});
    await this.module.tokens.deleteByUserId(user._id);
  }

  async _removeUserStrategies (user) {
    const availableStrategies = this.kuzzle.pluginsManager.listStrategies();
    const userStrategies = [];
    const request = new Request({ _id: user._id });

    for (const strategy of availableStrategies) {
      const existStrategy = this.kuzzle.pluginsManager.getStrategyMethod(
        strategy,
        'exists');

      if (await existStrategy(request, user._id, strategy)) {
        userStrategies.push(strategy);
      }
    }

    const errors = [];
    if (userStrategies.length > 0) {
      for (const strategy of userStrategies) {
        const deleteStrategy = this.kuzzle.pluginsManager.getStrategyMethod(
          strategy,
          'delete');

        // We catch any error produced by delete as we want to make as much
        // cleanup as possible
        try {
          await deleteStrategy(request, user._id, strategy);
        }
        catch (error) {
          errors.push(error);
        }
      }
    }

    if (errors.length > 0) {
      throw kerror.get(
        'security',
        'credentials',
        'rejected',
        errors.join('\n\t- '));
    }
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
        throw kerror.get('security', 'user', 'not_found', id);
      }
      throw err;
    }
  }
}

module.exports = UserRepository;
