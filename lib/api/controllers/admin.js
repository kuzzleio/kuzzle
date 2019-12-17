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

const
  errorsManager = require('../../util/errors'),
  { NativeController } = require('./base'),
  Bluebird = require('bluebird');

const _locks = {};

/**
 * @class AdminController
 * @param {Kuzzle} kuzzle
 */
class AdminController extends NativeController {
  constructor(kuzzle) {
    super(kuzzle, [
      'dump',
      'loadFixtures',
      'loadMappings',
      'loadSecurities',
      'resetCache',
      'resetDatabase',
      'resetSecurity',
      'shutdown'
    ]);
  }

  /**
   * Reset Redis cache
   */
  resetCache (request) {
    const database = this.getString(request, 'database');

    let cacheEngine;

    // @todo allow only memoryStorage
    if (database === 'internalCache') {
      cacheEngine = this.kuzzle.cacheEngine.internal;
    }
    else if (database === 'memoryStorage') {
      cacheEngine = this.kuzzle.cacheEngine.public;
    }
    else {
      throw errorsManager.get('services', 'cache', 'database_not_found', database);
    }

    cacheEngine.flushdb(); // NOSONAR

    return Bluebird.resolve({ acknowledge: true });
  }

  /**
   * Reset all roles, profiles and users
   */
  resetSecurity (request) {
    this._lockAction(
      request,
      'Kuzzle is already reseting roles, profiles and users.');

    const
      options = { refresh: 'wait_for' },
      result = {};

    return this.kuzzle.repositories.user.truncate(options)
      .then(deletedUsers => {
        result.deletedUsers = deletedUsers;
        return this.kuzzle.repositories.profile.truncate(options);
      })
      .then(deletedProfiles => {
        result.deletedProfiles = deletedProfiles;
        return this.kuzzle.repositories.role.truncate(options);
      })
      .then(deletedRoles => {
        result.deletedRoles = deletedRoles;
        return this.kuzzle.internalIndex.bootstrap.createInitialSecurities();
      })
      .then(({ profileIds, roleIds }) => (
        Bluebird.all([
          this.kuzzle.repositories.profile.loadProfiles(profileIds, { resetCache: true }),
          this.kuzzle.repositories.role.loadRoles(roleIds, { resetCache: true })
        ])
      ))
      .then(() => {
        delete _locks.resetSecurity;

        return result;
      })
      .catch(error => {
        delete _locks.resetSecurity;
        throw error;
      });
  }

  /**
   * Reset all indexes created by users
   */
  resetDatabase (request) {
    this._lockAction(request, 'Kuzzle is already reseting all indexes.');

    return this.publicStorage.listIndexes()
      .then(indexes => this.publicStorage.deleteIndexes(indexes))
      .then(() => {
        delete _locks.resetDatabase;

        return { acknowledge: true };
      })
      .catch(error => {
        delete _locks.resetDatabase;
        throw error;
      });
  }

  /**
   * Generate a dump
   * Janitor will throw a PreconditionError if a dump is already running
   */
  dump (request) {
    const
      suffix = this.getString(request, 'suffix', 'manual-api-action'),
      promise = this.kuzzle.janitor.dump(suffix);

    return this._waitForAction(request, promise, { acknowledge: true });
  }

  /**
   * Shutdown Kuzzle
   */
  shutdown (request) {
    this._lockAction(request, 'Kuzzle is already shutting down.');

    process.kill(process.pid, 'SIGTERM');

    return Bluebird.resolve({ acknowledge: true });
  }

  loadFixtures (request) {
    const fixtures = this.getBody(request);

    const promise = this.kuzzle.janitor.loadFixtures(fixtures);

    return this._waitForAction(request, promise, { acknowledge: true });
  }

  loadMappings (request) {
    const mappings = this.getBody(request);

    const promise = this.kuzzle.janitor.loadMappings(mappings);

    return this._waitForAction(request, promise, { acknowledge: true });
  }

  loadSecurities (request) {
    const securities = this.getBody(request);

    const promise = this.kuzzle.janitor.loadSecurities(securities);

    return this._waitForAction(request, promise, { acknowledge: true });
  }

  _lockAction (request, message) {
    const action = request.input.action;

    if (_locks[action]) {
      throw errorsManager.get('api', 'process', 'action_locked', message);
    }

    _locks[action] = true;
  }

  _waitForAction (request, promise, result) {
    const refresh = request.input.args.refresh === 'wait_for';

    if (! refresh) {
      // Attaching an error handler to the provided promise to prevent
      // uncaught rejections
      promise.catch(err => this.kuzzle.log.error(err));
      return Bluebird.resolve(result);
    }

    return promise
      .then(() => result);
  }

}

module.exports = AdminController;
