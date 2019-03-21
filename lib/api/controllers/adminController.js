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
  BaseController = require('./controller'),
  Bluebird = require('bluebird'),
  {
    BadRequestError,
    PreconditionError
  } = require('kuzzle-common-objects').errors,
  Request = require('kuzzle-common-objects').Request,
  assertArgsHasAttribute = require('../../util/requestAssertions').assertArgsHasAttribute;

const _locks = {};

/**
 * @class AdminController
 * @param {Kuzzle} kuzzle
 */
class AdminController extends BaseController {
  constructor(kuzzle) {
    super(kuzzle, [
      'dump',
      'resetCache',
      'resetDatabase',
      'resetKuzzleData',
      'resetSecurity',
      'shutdown'
    ]);
  }

  /**
   * Reset the internal storage components (internalEngine index, cache and memory storage)
   */
  resetKuzzleData (request) {
    this._lockAction(request, 'Kuzzle is already resetting his data.');

    return this.kuzzle.repositories.user.truncate({ refresh: 'wait_for' })
      .then(() => this.kuzzle.internalEngine.deleteIndex())
      .then(() => this.kuzzle.services.list.internalCache.flushdb())
      .then(() => {
        this.kuzzle.indexCache.remove(this.kuzzle.internalEngine.index);

        return this.kuzzle.internalEngine.bootstrap.all();
      })
      .then(() => {
        delete _locks.resetKuzzleData;

        return { acknowledge: true };
      })
      .catch(error => {
        delete _locks.resetKuzzleData;
        throw error;
      });
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
    this._lockAction(request, 'Kuzzle is already reseting roles, profiles and users.');

    const
      options = { refresh: 'wait_for' },
      result = {};

    return this.kuzzle.repositories.user.truncate(options)
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
      .then(() => this.kuzzle.internalEngine.bootstrap.createDefaultRoles())
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

    const indexes = Object.keys(this.kuzzle.indexCache.indexes).filter(idx => idx[0] !== '%');

    return Bluebird.map(indexes, index => {
      const req = new Request({ index, refresh: request.input.args.refresh });

      return this.kuzzle.services.list.storageEngine.deleteIndex(req)
        .then(() => this.kuzzle.indexCache.remove(index));
    })
      .then(() =>{
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
    const suffix = request.input.args.suffix ? request.input.args.suffix : '';

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
    const fixtures = request.input.body;

    const promise = this.kuzzle.janitor.loadFixtures(fixtures);

    return this._waitForAction(request, promise, { acknowledge: true });
  }

  loadMappings (request) {
    const mappings = request.input.body;

    const promise = this.kuzzle.janitor.loadMappings(mappings);

    return this._waitForAction(request, promise, { acknowledge: true });
  }

  loadSecurities (request) {
    const securities = request.input.body;

    const promise = this.kuzzle.janitor.loadSecurities(securities);

    return this._waitForAction(request, promise, { acknowledge: true });
  }

  _lockAction (request, message) {
    const action = request.input.action;

    if (_locks[action]) {
      throw new PreconditionError(message);
    }

    _locks[action] = true;
  }

  _waitForAction (request, promise, result) {
    const refresh = request.input.args.refresh === 'wait_for';

    if (!refresh) {
      return Bluebird.resolve(result);
    }

    return promise
      .then(() => result);
  }

}

module.exports = AdminController;
