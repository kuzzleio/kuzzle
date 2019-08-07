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

const
  _ = require('lodash'),
  Bluebird = require('bluebird'),
  errorsManager = require('../../config/error-codes/throw.js');

// Base class for all API controllers
class BaseController {
  constructor(kuzzle, actions = []) {
    this.kuzzle = kuzzle;
    this._actions = new Set(actions);
  }

  /**
   * Controller optional initialization method.
   * Used to perform asynchronous initialization safely: the funnel will wait
   * for all controllers to be initialized before accepting requests.
   *
   * @return {Promise.<null>}
   */
  init() {
    return Bluebird.resolve(null);
  }

  /**
   * Check if the provided action name exists within that controller.
   * This check's purpose is to prevent actions leak by making actions exposure
   * explicit.
   *
   * @param  {string} name
   * @return {boolean}
   */
  isAction(name) {
    return this.actions.has(name);
  }

  get actions() {
    return this._actions;
  }

  /**
   * Get a boolean param from request input
   * For HTTP, flag presence mean true value
   *
   * @param {Request} request
   * @param {string} flagPath
   */
  tryGetBoolean (request, flagPath) {
    const
      flagName = flagPath.split('.').slice(-1),
      flagValue = _.get(request, `input.${flagPath}`);

    // In HTTP, booleans are flags: if it's in the querystring, it's set, whatever
    // its value.
    // If a user needs to unset the option, they need to remove it from the querystring.
    if (request.context.connection.protocol !== 'http'
      && !_.isNil(flagValue)
      && typeof flagValue !== 'boolean'
    ) {
      errorsManager.throw(
        'api',
        'base',
        'invalid_value_type',
        flagName, flagValue);
    } else if (request.context.connection.protocol === 'http') {
      const booleanValue = flagValue !== undefined ? true : false;

      _.set(request, flagPath, booleanValue);

      return booleanValue;
    }

    return Boolean(flagValue);
  }
}

module.exports = BaseController;
