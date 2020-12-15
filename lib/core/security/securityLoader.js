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

const { isEmpty } = require('lodash');
const Bluebird = require('bluebird');

const { Request } = require('../../api/request');
const { assertIsObject } = require('../../util/requestAssertions');
const kerror = require('../../kerror');

/**
 * Load roles, profiles and users fixtures into Kuzzle
 *
 * @param {object} securities
 * @returns {Promise}
 */
class SecurityLoader {
  constructor () {
  }

  async init () {
    /**
     * Loads a JSON containing security roles, profiles and users.
     * @param {Object} json
     * @param {Object} opts - force, onExistingUsers, user
     */
    global.kuzzle.onAsk(
      'core:security:load',
      (json, opts) => this.load(json, opts));
  }

  async load(securities = {}, {force, onExistingUsers='fail', user=null} = {}) {
    assertIsObject(securities);

    await this._create('createOrReplaceRole', securities.roles, 'roles', {
      force,
      user,
    });

    await this._create(
      'createOrReplaceProfile',
      securities.profiles,
      'profiles',
      { user });

    const usersToLoad = await this._getUsersToLoad(securities.users, {
      onExistingUsers,
      user,
    });

    await this._create('createUser', usersToLoad, 'users', { user });
  }

  async _create (action, objects, collection, { user, force } = {}) {
    if (! objects) {
      return;
    }

    assertIsObject(objects);

    const promises = [];

    for (const [_id, body] of Object.entries(objects)) {
      assertIsObject(body);

      const request = new Request({
        _id,
        action,
        body,
        controller: 'security',
        force,
        refresh: false,
      }, { user });

      promises.push(global.kuzzle.funnel.processRequest(request));
    }

    await Bluebird.all(promises);

    await global.kuzzle.internalIndex.refreshCollection(collection);
  }

  async _getUsersToLoad (users, { onExistingUsers } = {}) {
    if (isEmpty(users)) {
      return users;
    }

    const ids = Object.keys(users);
    const mGetUsers = new Request({
      action: 'mGetUsers',
      body: { ids },
      controller: 'security'
    });

    const { result } = await global.kuzzle.funnel.processRequest(mGetUsers);

    const existingUserIds = result.hits.map(({ _id }) => _id);

    if (existingUserIds.length === 0) {
      return users;
    }

    if (onExistingUsers === 'fail') {
      throw kerror.get('security', 'user', 'prevent_overwrite');
    }
    else if (onExistingUsers === 'skip') {
      return Object.entries(users)
        .reduce((memo, [userId, content]) => {
          if (! existingUserIds.includes(userId)) {
            memo[userId] = content;
          }

          return memo;
        }, {});
    }
    else if (onExistingUsers === 'overwrite') {
      const mDeleteUsers = new Request({
        action: 'mDeleteUsers',
        body: { ids: existingUserIds },
        controller: 'security',
        refresh: false
      });

      await global.kuzzle.funnel.processRequest(mDeleteUsers);

      return users;
    }
    else {
      throw kerror.get(
        'api',
        'assert',
        'unexpected_argument',
        'onExistingUsers',
        ['skip', 'overwrite', 'fail']);
    }
  }
}

module.exports = SecurityLoader;
