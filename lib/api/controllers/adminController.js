/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
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
  errorsManager = require('../../config/error-codes/throw').wrap('api', 'admin'),
  BaseController = require('./baseController'),
  Bluebird = require('bluebird');

const _locks = {};

/**
 * @class AdminController
 * @param {Kuzzle} kuzzle
 */
class AdminController extends BaseController {
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
    const database = this.getStringParam(request, 'args.database');

    let cacheEngine;

    // @todo allow only publicCache
    if (database === 'internalCache') {
      cacheEngine = this.kuzzle.cacheEngine.internal;
    } else if (database === 'publicCache' || database === 'memoryStorage') {
      cacheEngine = this.kuzzle.cacheEngine.public;
    } else {
      errorsManager.throw('database_not_found', database);
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
    const suffix = this.getStringParam(request, 'args.suffix', 'manual-api-action');

    const promise = this.kuzzle.janitor.dump(suffix);

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
    const fixtures = this.getObjectParam(request, 'body');

    const promise = this.kuzzle.janitor.loadFixtures(fixtures);

    return this._waitForAction(request, promise, { acknowledge: true });
  }

  loadMappings (request) {
    const mappings = this.getObjectParam(request, 'body');

    const promise = this.kuzzle.janitor.loadMappings(mappings);

    return this._waitForAction(request, promise, { acknowledge: true });
  }

  loadSecurities (request) {
    const securities = this.getObjectParam(request, 'body');

    const promise = this.kuzzle.janitor.loadSecurities(securities);

    return this._waitForAction(request, promise, { acknowledge: true });
  }

  _lockAction (request, message) {
    const action = request.input.action;

    if (_locks[action]) {
      errorsManager.throw('action_locked', message);
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
