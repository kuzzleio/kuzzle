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

const _ = require('lodash');
const { Request } = require('kuzzle-common-objects');
const { assertIsObject } = require('../../util/requestAssertions');
const kerror = require('../../kerror');

/**
 * Load roles, profiles and users fixtures into Kuzzle
 *
 * @param {object} securities
 * @returns {Promise}
 */
async function loadSecurities (
  kuzzle,
  securities = {},
  { force, onExistingUsers='fail', user=null } = {}
) {
  assertIsObject(securities);

  await _createSecurity(
    kuzzle,
    'createOrReplaceRole',
    securities.roles,
    'roles',
    { force, user });

  await _createSecurity(
    kuzzle,
    'createOrReplaceProfile',
    securities.profiles,
    'profiles',
    { user });

  const usersToLoad = await _getUsersToLoad(
    kuzzle,
    securities.users,
    { onExistingUsers, user });

  await _createSecurity(kuzzle, 'createUser', usersToLoad, 'users', { user });
}

async function _createSecurity (
  kuzzle,
  action,
  objects,
  collection,
  { user, force } = {}
) {
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

    promises.push(kuzzle.funnel.processRequest(request));
  }

  await Promise.all(promises);

  await kuzzle.storageEngine.internal.refreshCollection(
    kuzzle.storageEngine.config.internalIndex.name,
    collection);
}

async function _getUsersToLoad (kuzzle, users, { onExistingUsers } = {}) {
  if (_.isEmpty(users)) {
    return users;
  }

  const ids = Object.keys(users);

  const mGetUsers = new Request({
    action: 'mGetUsers',
    body: { ids },
    controller: 'security'
  });

  const { result } = await kuzzle.funnel.processRequest(mGetUsers);

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

    await kuzzle.funnel.processRequest(mDeleteUsers);

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

module.exports = loadSecurities;
