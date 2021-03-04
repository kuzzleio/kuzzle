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

const { KuzzleError } = require('../../kerror/errors');
const kerror = require('../../kerror');
const { NativeController, ifMissingEnum } = require('./baseController');
const { get } = require('../../util/safeObject');
const nameGenerator = require('../../util/name-generator');
const formatProcessing = require('../../core/auth/formatProcessing');
const { v4: uuidv4 } = require('uuid');

/**
 * @class UserController
 */
class UserController extends NativeController {
  constructor() {
    super([
      'create'
    ]);

    this.subdomain = 'security';
  }

  /**
   * Creates a new User object in Kuzzle's database layer
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  async create (request) {
    const content = this.getBodyObject(request, 'content');
    const profileIds = get(content, 'profileIds');
    const humanReadableId = this.getString(request, 'kuid', 'human') !== 'uuid';

    if (profileIds === undefined) {
      throw kerror.get('api', 'assert', 'missing_argument', 'body.content.profileIds');
    }

    if (!Array.isArray(profileIds)) {
      throw kerror.get('api', 'assert', 'invalid_type', 'body.content.profileIds', 'array');
    }

    return this._persistUser(request, profileIds, content, { humanReadableId });
  }

  /**
   * @param {Request} request
   * @returns {Promise}
   * @private
   */
  async _persistUser(request, profileIds, content, { humanReadableId = true } = {}) {
    const generator = humanReadableId ? nameGenerator : uuidv4;
    const credentials = this.getBodyObject(request, 'credentials', {});
    const strategies = Object.keys(credentials);

    let id = '';
    let alreadyExists = false;
    // Early checks before the user is created
    do {
      let generated = false;
      id = this.getId(
        request,
        ifMissingEnum.GENERATE,
        () => {
          generated = true;
          return `kuid-${generator()}`;
        }
      );

      for (const strategy of strategies) {
        if (!global.kuzzle.pluginsManager.listStrategies().includes(strategy)) {
          throw kerror.get(
            'security',
            'credentials',
            'unknown_strategy',
            strategy);
        }

        const exists = this.getStrategyMethod(strategy, 'exists');
        alreadyExists = await exists(request, id, strategy);
        if (alreadyExists) {
          if (generated) {
            break; // exit for loop, to regenerate an id
          }

          throw kerror.get(
            'security',
            'credentials',
            'database_inconsistency',
            id);
        }
      }

    } while (alreadyExists);

    const user = await this.ask(
      'core:security:user:create',
      id,
      profileIds,
      content,
      { refresh: this.getRefresh(request, 'wait_for') });

    const createdUser = formatProcessing.serializeUser(user);

    // Creating credentials
    let creationFailure = null;
    const createdStrategies = [];

    for (const strategy of strategies) {
      try {
        const validate = this.getStrategyMethod(strategy,'validate');

        await validate(request, credentials[strategy], id, strategy, false);
      }
      catch (error) {
        creationFailure = {error, validation: true};
        break;
      }

      try {
        const create = this.getStrategyMethod(strategy, 'create');

        await create(request, credentials[strategy], id, strategy);
        createdStrategies.push(strategy);
      }
      catch (error) {
        creationFailure = {error, validation: false};
        break;
      }
    }

    if (creationFailure === null) {
      global.kuzzle.log.info(`[SECURITY] User "${this.getUserId(request)}" applied action "${request.input.action}" on user "${id}."`);
      return createdUser;
    }

    // Failed to create credentials: rollback created strategies
    const deletionErrors = [];
    for (const strategy of createdStrategies) {
      try {
        const del = this.getStrategyMethod(strategy, 'delete');
        await del(request, id, strategy);
      }
      catch (e) {
        // We catch any error produced by delete as we want to make as much
        // cleanup as possible
        deletionErrors.push(e);
      }
    }

    try {
      this.ask('core:security:user:delete', id, { refresh: 'false' });
    }
    catch (e) {
      global.kuzzle.log.error(`User rollback error: ${e}`);
    }

    if (deletionErrors.length > 0) {
      // 2 errors > we
      throw kerror.get(
        'plugin',
        'runtime',
        'unexpected_error',
        [
          creationFailure.error.message,
          ...deletionErrors.map(e => e.message)
        ].join('\n'));
    }

    if (creationFailure.error instanceof KuzzleError) {
      throw creationFailure.error;
    }

    if (creationFailure.validation) {
      throw kerror.getFrom(
        creationFailure.error,
        'security',
        'credentials',
        'rejected',
        creationFailure.error.message);
    }

    throw kerror.getFrom(
      creationFailure.error,
      'plugin',
      'runtime',
      'unexpected_error',
      creationFailure.error.message);
  }
}

module.exports = UserController;
