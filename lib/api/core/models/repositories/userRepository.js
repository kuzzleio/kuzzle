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
  Bluebird = require('bluebird'),
  uuid = require('uuid/v4'),
  User = require('../security/user'),
  Repository = require('./repository'),
  Request = require('kuzzle-common-objects').Request,
  {
    BadRequestError,
    NotFoundError,
    InternalError: KuzzleInternalError
  } = require('kuzzle-common-objects').errors;

  /**
   * @param {Kuzzle} kuzzle
   * @param {User} user
   */
  const removeUserStrategies = Bluebird.coroutine(function* removeUserGenerator (kuzzle, user) {
    const
      availableStrategies = kuzzle.pluginsManager.listStrategies(),
      userStrategies = [],
      errors = [],
      request = new Request({ _id: user._id });

    for (const strategy of availableStrategies) {
      const
        existsMethod = kuzzle.pluginsManager.getStrategyMethod(strategy, 'exists'),
        existStrategy = yield existsMethod(request, user._id, strategy);

      if (existStrategy) {
        userStrategies.push(strategy);
      }
    }

    if (userStrategies.length > 0) {
      for (const strategy of userStrategies) {
        const
          deleteMethod = kuzzle.pluginsManager.getStrategyMethod(strategy, 'delete');

        // We catch any error produced by delete as we want to make as much cleanup as possible
        yield deleteMethod(request, user._id, strategy)
          .catch(error => {
            errors.push(error);
            return Bluebird.reject(error);
          });
      }
    }

    if (errors.length > 0) {
      throw new KuzzleInternalError(`was not able to remove bad credentials of user "${user._id}": ` + errors.map(error => error.message).join(';'));
    }
  });

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

  init () {
    super.init({});
  }

  load (id) {
    if (id === 'anonymous' || id === '-1') {
      return Bluebird.resolve(this.anonymous());
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
          return Bluebird.reject(new BadRequestError('Anonymous user must be assigned the anonymous profile'));
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
              throw new NotFoundError(`Unable to hydrate the user ${dto._id}: missing profile(s) in the database`);
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
  delete (user, options = {}) {
    return super.delete(user, options)
      .then(() => this.kuzzle.repositories.token.deleteByUserId(user._id))
      .then(() => removeUserStrategies(this.kuzzle, user))
      .then(() => ({ _id: user._id }));
  }
}

module.exports = UserRepository;
