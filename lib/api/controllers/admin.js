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

const errorsManager = require('../../util/errors');
const { NativeController } = require('./base');
const Bluebird = require('bluebird');

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
  async resetSecurity (request) {
    this._lockAction(
      request,
      'Kuzzle is already reseting roles, profiles and users.');

    const result = {};

    try {
      const repositories = this.kuzzle.repositories;

      const options = { refresh: 'wait_for' };

      result.deletedUsers = await repositories.user.truncate(options);
      result.deletedProfiles = await repositories.profile.truncate(options);
      result.deletedRoles = await repositories.role.truncate(options);

      const { profileIds, roleIds } = await this.kuzzle.internalIndex
        .bootstrap
        .createInitialSecurities();

      await Bluebird.all([
        repositories.profile.loadProfiles(profileIds, { resetCache: true }),
        repositories.role.loadRoles(roleIds, { resetCache: true })
      ]);
    }
    finally {
      delete _locks.resetSecurity;
    }

    return result;
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
    const waitForRefresh = request.input.args.refresh === 'wait_for';
    const suffix = this.getString(request, 'suffix', 'manual-api-action');

    const promise = this.kuzzle.janitor.dump(suffix);

    return this._waitForAction(waitForRefresh, promise);
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
    const waitForRefresh = this.getRefresh(request, 'true');

    const promise = this.kuzzle.janitor.loadFixtures(fixtures);

    return this._waitForAction(waitForRefresh, promise);
  }

  loadMappings (request) {
    const mappings = this.getBody(request);
    const waitForRefresh = this.getRefresh(request, 'true');

    const promise = this.kuzzle.janitor.loadMappings(mappings);

    return this._waitForAction(waitForRefresh, promise);
  }

  async loadSecurities (request) {
    const securities = this.getBody(request);
    const user = this.getUser(request);
    const onExistingUsers = request.input.args.onExistingUsers;
    const force = this.getBoolean(request, 'force');
    const waitForRefresh = this.getRefresh(request, 'true');

    const promise = this.kuzzle.janitor.loadSecurities(
      securities,
      { force, onExistingUsers, user });

    return this._waitForAction(waitForRefresh, promise);
  }

  _lockAction (request, message) {
    const action = request.input.action;

    if (_locks[action]) {
      throw errorsManager.get('api', 'process', 'action_locked', message);
    }

    _locks[action] = true;
  }

  _waitForAction (waitForRefresh, promise) {
    const result = { acknowledge: true };

    if (waitForRefresh === 'false') {
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
