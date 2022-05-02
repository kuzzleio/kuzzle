/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
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

const Bluebird = require('bluebird');

const kerror = require('../../kerror');
const { NativeController } = require('./baseController');
const { Mutex } = require('../../util/mutex');

/**
 * @class AdminController
 */
class AdminController extends NativeController {
  constructor () {
    super([
      'dump',
      'loadFixtures',
      'loadMappings',
      'loadSecurities',
      'refreshIndexCache',
      'resetCache',
      'resetDatabase',
      'resetSecurity',
      'shutdown'
    ]);

    this.shuttingDown = false;
  }

  async refreshIndexCache () {
    await global.kuzzle.ask('core:storage:public:cache:refresh');
  }

  /**
   * Reset Redis cache
   */
  async resetCache (request) {
    const database = request.getString('database');

    // @todo allow only memoryStorage
    if (database === 'internalCache') {
      await this.ask('core:cache:internal:flushdb');
    }
    else if (database === 'memoryStorage') {
      await this.ask('core:cache:public:flushdb');
    }
    else {
      throw kerror.get('services', 'cache', 'database_not_found', database);
    }

    return { acknowledge: true };
  }

  /**
   * Reset all roles, profiles and users
   */
  async resetSecurity () {
    const mutex = new Mutex('resetSecurity', { timeout: 0 });

    if (! await mutex.lock()) {
      throw kerror.get('api', 'process', 'action_locked', 'Kuzzle is already reseting roles, profiles and users.');
    }

    const result = {};

    try {
      const options = { refresh: 'wait_for' };

      result.deletedUsers = await this.ask(
        'core:security:user:truncate',
        options);
      result.deletedProfiles = await this.ask(
        'core:security:profile:truncate',
        options);
      result.deletedRoles = await this.ask(
        'core:security:role:truncate',
        options);

      await global.kuzzle.internalIndex.createInitialSecurities();
    }
    finally {
      await mutex.unlock();
    }

    return result;
  }

  /**
   * Reset all indexes created by users
   */
  async resetDatabase () {
    const mutex = new Mutex('resetDatabase', { timeout: 0 });

    if (! await mutex.lock()) {
      throw kerror.get('api', 'process', 'action_locked', 'Kuzzle is already reseting all indexes.');
    }

    try {
      const indexes = await this.ask('core:storage:public:index:list');
      await this.ask('core:storage:public:index:mDelete', indexes);

      return { acknowledge: true };
    }
    finally {
      await mutex.unlock();
    }
  }

  /**
   * Generate a dump
   * Kuzzle will throw a PreconditionError if a dump is already running
   */
  dump (request) {
    const waitForRefresh = request.input.args.refresh === 'wait_for';
    const suffix = request.getString('suffix', 'manual-api-action');

    const promise = global.kuzzle.dump(suffix);

    return this._waitForAction(waitForRefresh, promise);
  }

  /**
   * Shutdown Kuzzle
   */
  async shutdown () {
    if (this.shuttingDown) {
      throw kerror.get('api', 'process', 'action_locked', 'Kuzzle is already shutting down.');
    }

    global.kuzzle.shutdown();

    return { acknowledge: true };
  }

  loadFixtures (request) {
    const fixtures = request.getBody();
    const refresh = request.getRefresh('wait_for');

    return global.kuzzle.ask('core:storage:public:document:import', fixtures, {
      refresh
    });
  }

  loadMappings (request) {
    const mappings = request.getBody();

    return this._waitForAction(
      request.getRefresh('wait_for'),
      global.kuzzle.ask(
        'core:storage:public:mappings:import',
        mappings,
        { rawMappings: true }));
  }

  async loadSecurities (request) {
    const permissions = request.getBody();
    const user = request.getUser();
    const onExistingUsers = request.input.args.onExistingUsers;
    const force = request.getBoolean('force');
    const waitForRefresh = request.getRefresh('wait_for');

    const promise = this.ask('core:security:load', permissions, {
      force,
      onExistingUsers,
      refresh: waitForRefresh,
      user,
    });

    return this._waitForAction(waitForRefresh, promise);
  }

  _waitForAction (waitForRefresh, promise) {
    const result = { acknowledge: true };

    if (waitForRefresh === 'false') {
      // Attaching an error handler to the provided promise to prevent
      // uncaught rejections
      promise.catch(err => global.kuzzle.log.error(err));

      return Bluebird.resolve(result);
    }

    return promise
      .then(() => result);
  }

}

module.exports = AdminController;
