/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2017 Kuzzle
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
  Bluebird = require('bluebird'),
  passport = require('passport'),
  PassportResponse = require('./passportResponse'),
  {
    KuzzleError,
    BadRequestError,
    UnauthorizedError,
    PluginImplementationError
  } = require('kuzzle-common-objects').errors;

/**
 * @class PassportWrapper
 */
class PassportWrapper {
  constructor() {
    this.options = {};
  }

  /**
   * @param {{query: Object}}request
   * @param strategy
   * @returns {Promise.<*>}
   */
  authenticate(request, strategy) {
    const response = new PassportResponse();

    if (!passport._strategy(strategy)) {
      return Bluebird.reject(new BadRequestError(`Unknown authentication strategy "${strategy}"`));
    }

    return new Bluebird((resolve, reject) => {
      response.addEndListener(() => resolve(response));

      passport.authenticate(strategy, this.options[strategy] || {}, (err, user, info) => {
        if (err !== null) {
          if (err instanceof KuzzleError) {
            reject(err);
          }
          else {
            reject(new PluginImplementationError(err));
          }
        }
        else if (!user) {
          const error = new UnauthorizedError(info.message);
          error.details = {
            subCode: error.subCodes.AuthenticationError
          };
          reject(error);
        }
        else {
          resolve(user);
        }
      })(request, response);
    });
  }

  /**
   * Exposes passport.use function
   *
   * @param {string} name - strategy name
   * @param {object} strategy - instantiated strategy object
   * @param {object} opts - options to provide to authenticate with the strategy
   */
  use(name, strategy, opts = {}) {
    passport.use(name, strategy);
    this.options[strategy] = opts;
  }

  /**
   * Exposes passport.unuse, unregistering a strategy from kuzzle
   *  
   * @param  {string} name - name of the strategy to unregister
   */
  unuse(name) {
    passport.unuse(name);
    delete this.options[name];
  }
}

module.exports = PassportWrapper;
