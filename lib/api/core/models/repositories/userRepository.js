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
  uuid = require('node-uuid'),
  User = require('../security/user'),
  Repository = require('./repository'),
  {
    BadRequestError,
    NotFoundError
  } = require('kuzzle-common-objects').errors;

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

    return super.load(id)
      .then(user => {
        if (user === null) {
          return null;
        }
        return this.hydrate(new User(), user);
      });
  }

  persist (user, options = {}) {
    const
      databaseOptions = options.database || {},
      cacheOptions = options.cache || {};

    if (user._id === undefined || user._id === null) {
      user._id = uuid.v4();
    }

    if (user._id === this.anonymous()._id && user.profileIds.indexOf('anonymous') === -1) {
      return Promise.reject(new BadRequestError('Anonymous user must be assigned the anonymous profile'));
    }

    return this.persistToDatabase(user, databaseOptions)
      .then(() => this.persistToCache(user, cacheOptions))
      .then(() => user);
  }

  /**
   * @returns User
   */
  anonymous () {
    const user = new User();

    return Object.assign(user, {
      _id: '-1',
      name: 'Anonymous',
      profileIds: ['anonymous']
    });
  }

  hydrate (user, data) {
    let dataprofileIds;

    if (!data || typeof data !== 'object') {
      return Bluebird.resolve(user);
    }

    if (data._source) {
      const source = data._source;
      delete data._source;
      Object.assign(data, source);
    }

    if (data.profileIds) {
      if (!Array.isArray(data.profileIds)) {
        data.profileIds = [data.profileIds];
      }

      dataprofileIds = data.profileIds;
      delete data.profileIds;
    }

    Object.assign(user, data);
    Object.assign(user.profileIds, dataprofileIds);

    if (user._id === undefined || user._id === null) {
      return Bluebird.resolve(this.anonymous());
    }

    // if the user exists (have an _id) but no profile
    // set it to default
    if (user.profileIds.length === 0) {
      user.profileIds = this.kuzzle.config.security.restrictedProfileIds;
    }

    return this.kuzzle.repositories.profile.loadProfiles(user.profileIds)
      .then(profiles => {
        const
          profileIds = profiles.map(profile => profile._id),
          profilesNotFound = _.difference(user.profileIds, profileIds);

        // Fail if not all roles are found
        if (profilesNotFound.length) {
          return Bluebird.reject(new NotFoundError(`Unable to hydrate the user ${data._id}. The following profiles don't exist: ${profilesNotFound}`));
        }

        return user;
      });
  }

  serializeToCache (user) {
    // avoid to mutate the user object
    return Object.assign({}, user);
  }

  serializeToDatabase (user) {
    const result = this.serializeToCache(user);

    delete result._id;

    return result;
  }
}

module.exports = UserRepository;
