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

const debug = require('../../util/debug')('kuzzle:repositories:user');
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
   * @param {object} options
   * @constructor
   */
  constructor (kuzzle, options) {
    super(kuzzle);

    this.collection = 'users';
    this.ObjectConstructor = User;

    if (options !== undefined && options.ttl !== undefined) {
      this.ttl = options.ttl;
    }
  }

  init (options = {}) {
    super.init({
      indexStorage: options.indexStorage
    });
  }

  /**
   * Load a user from the repository
   *
   * @param {string} id
   * @return {Promise|null}
   *
   */
  load (id) {
    if (id === 'anonymous' || id === '-1') {
      return this.anonymous();
    }

    return super.load(id);
  }

  persist (user, options = {}) {
    const
      databaseOptions = options.database || {},
      cacheOptions = options.cache || {};

    if (user._id === undefined || user._id === null) {
      user._id = uuid();
    }

    return this.anonymous()
      .then(anonymous => {
        if (user._id === anonymous._id && user.profileIds.indexOf('anonymous') === -1) {
          throw kerror.get('security', 'user', 'anonymous_profile_required');
        }

        return this.persistToDatabase(user, databaseOptions);
      })
      .then(() => this.persistToCache(user, cacheOptions))
      .then(() => user);
  }

  /**
   * @returns User
   */
  anonymous () {
    return this.fromDTO({
      _id: '-1',
      name: 'Anonymous',
      profileIds: ['anonymous']
    });
  }

  /**
   * @param dto
   * @returns {Promise<User>}
   */
  fromDTO (dto) {
    if (dto.profileIds && !Array.isArray(dto.profileIds)) {
      dto.profileIds = [dto.profileIds];
    }

    return super.fromDTO(dto)
      .then(user => {
        if (user._id === undefined || user._id === null) {
          return this.anonymous();
        }

        // if the user exists (have an _id) but no profile
        // set it to default
        if (user.profileIds.length === 0) {
          user.profileIds = this.kuzzle.config.security.restrictedProfileIds;
        }

        return this.kuzzle.repositories.profile.loadProfiles(user.profileIds)
          .then(profiles => {
            // Fail if not all profiles are found
            if (profiles.some(p => p === null)) {
              throw kerror.get('security', 'user', 'cannot_hydrate', dto._id);
            }

            return user;
          });
      });
  }

  /**
   * Given a User object :
   * - delete it from memory and database
   * - delete related token
   * - delete related stategies
   *
   * @param {User} user
   * @param {object} [options]
   * @returns {Promise}
   */
  async delete (user, options = {}) {
    debug('Delete user %a', user);

    await super.delete(user, options);
    await this._removeUserStrategies(user);
    await ApiKey.deleteByUser(user, options);
    await this.kuzzle.repositories.token.deleteByUserId(user._id);

    return { _id: user._id };
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
}

module.exports = UserRepository;
