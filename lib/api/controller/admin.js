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

const Bluebird = require('bluebird');

const kerror = require('../../kerror');
const { NativeController } = require('./base');
const Mutex = require('../../util/mutex');

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

    this.shuttingDown = false;
  }

  /**
   * Reset Redis cache
   */
  async resetCache (request) {
    const database = this.getString(request, 'database');

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
    const mutex = new Mutex(this._kuzzle, 'resetSecurity', 0);

    if (!await mutex.lock()) {
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

      await this.kuzzle.internalIndex.createInitialSecurities();
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
    const mutex = new Mutex(this._kuzzle, 'resetDatabase', 0);

    if (!await mutex.lock()) {
      throw kerror.get('api', 'process', 'action_locked', 'Kuzzle is already reseting all indexes.');
    }

    try {
      const indexes = await this.ask('core:store:public:index:list');
      await this.ask('core:store:public:index:mDelete', indexes);

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
    const suffix = this.getString(request, 'suffix', 'manual-api-action');

    const promise = this.kuzzle.dump(suffix);

    return this._waitForAction(waitForRefresh, promise);
  }

  /**
   * Shutdown Kuzzle
   */
  async shutdown () {
    if (this.shuttingDown) {
      throw kerror.get('api', 'process', 'action_locked', 'Kuzzle is already shutting down.');
    }

    this.kuzzle.shutdown();

    return { acknowledge: true };
  }

  loadFixtures (request) {
    const fixtures = this.getBody(request);

    return this._waitForAction(
      this.getRefresh(request, 'true'),
      this.kuzzle.ask('core:store:public:document:import', fixtures));
  }

  loadMappings (request) {
    const mappings = this.getBody(request);

    return this._waitForAction(
      this.getRefresh(request, 'true'),
      this.kuzzle.ask('core:store:public:mappings:import', mappings));
  }

  async loadSecurities (request) {
    const securities = this.getBody(request);
    const user = this.getUser(request);
    const onExistingUsers = request.input.args.onExistingUsers;
    const force = this.getBoolean(request, 'force');
    const waitForRefresh = this.getRefresh(request, 'true');

    const promise = this.ask('core:security:load', securities, {
      force,
      onExistingUsers,
      user,
    });

    return this._waitForAction(waitForRefresh, promise);
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
