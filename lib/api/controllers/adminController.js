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
  {
    BadRequestError
  } = require('kuzzle-common-objects').errors,
  Request = require('kuzzle-common-objects').Request,
  {
    assertArgsHasAttribute
  } = require('../../util/requestAssertions');

let
  _shutdown = false;

/**
 * @class AdminController
 * @param {Kuzzle} kuzzle
 */
class AdminController {
  constructor(kuzzle) {
    this.kuzzle = kuzzle;
  }

  /**
   * Reset the internal storage components (internalEngine index, cache and memory storage)
   */
  resetKuzzleData () {
    const options = { refresh: 'wait_for' };

    this.kuzzle.repositories.user.truncate(options)
      .then(() => this.kuzzle.internalEngine.deleteIndex())
      .then(() => this.kuzzle.services.list.internalCache.flushdb())
      .then(() => {
        this.kuzzle.indexCache.remove(this.kuzzle.internalEngine.index);

        return this.kuzzle.internalEngine.bootstrap.all();
      });

    return Bluebird.resolve({ acknowledge: true });
  }

  /**
   * Reset Redis cache
   */
  resetCache (request) {
    assertArgsHasAttribute(request, 'database');

    const
      database = request.input.args.database,
      cacheEngine = this.kuzzle.services.list[database];

    if (! (cacheEngine !== undefined && typeof cacheEngine.flushdb === 'function')) {
      throw new BadRequestError(`Database ${database} not found`);
    }

    cacheEngine.flushdb();

    return Bluebird.resolve({ acknowledge: true });
  }

  /**
   * Reset all roles, profiles and users
   */
  resetSecurity (request) {
    const
      refresh = request.input.args.refresh,
      options = { refresh: 'wait_for' },
      result = {};

    const promise = this.kuzzle.repositories.user.truncate(options)
      .then(deletedUsers => {
        result.deleteUsers = deletedUsers;
        return this.kuzzle.repositories.profile.truncate(options);
      })
      .then(deletedProfiles => {
        result.deletedProfiles = deletedProfiles;
        return this.kuzzle.repositories.role.truncate(options);
      })
      .then(deletedRoles => {
        result.deletedRoles = deletedRoles;
        return this.kuzzle.internalEngine.bootstrap.createDefaultProfiles();
      })
      .then(() => this.kuzzle.internalEngine.bootstrap.createDefaultRoles());

    if (refresh === 'wait_for') {
      return promise.then(() => result);
    }

    return Bluebird.resolve({ acknowledge: true });
  }

  /**
   * Reset all indexes created by users
   */
  resetDatabase () {
    const indexes = Object.keys(this.kuzzle.indexCache.indexes).filter(idx => idx[0] !== '%');

    Bluebird.map(indexes, index => {
      const request = new Request({ index });

      return this.kuzzle.services.list.storageEngine.deleteIndex(request)
        .then(() => delete this.kuzzle.indexCache.indexes[index]);
    });

    return Bluebird.resolve({ acknowledge: true });
  }

  /**
   * Generate a dump
   */
  dump (request) {
    const suffix = request.input.args.suffix ? request.input.args.suffix : '';

    this.kuzzle.janitor.dump(suffix);

    return Bluebird.resolve({ acknowledge: true });
  }

  /**
   * Shutdown Kuzzle
   */
  shutdown () {
    if (_shutdown) {
      throw new BadRequestError('Kuzzle is already shutting down.');
    }

    _shutdown = true;

    process.kill(process.pid, 'SIGTERM');

    return Bluebird.resolve({ acknowledge: true });
  }

}

module.exports = AdminController;
