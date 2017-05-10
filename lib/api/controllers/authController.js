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

'use strict';

const
  Bluebird = require('bluebird'),
  _ = require('lodash'),
  Token = require('../core/models/security/token'),
  formatProcessing = require('../core/auth/formatProcessing'),
  {InternalError: KuzzleInternalError} = require('kuzzle-common-objects').errors,
  {
    assertIsStrategyRegistered,
    assertIsConnected,
    assertHasBody,
    assertHasStrategy,
    assertBodyHasNotAttribute,
    assertBodyHasAttribute
  } = require('../../util/requestAssertions');

/**
 * @class AuthController
 * @param {Kuzzle} kuzzle
 */
class AuthController {
  /**
   * @param {Kuzzle} kuzzle
   * @constructor
   */
  constructor(kuzzle) {
    this.kuzzle = kuzzle;
  }

  /**
   * Logs the current user out
   *
   * @param {Request} request
   * @returns {Promise<object>}
   */
  logout(request) {
    return this.kuzzle.repositories.token.expire(request.context.token)
      .then(() => Bluebird.resolve({}))
      .catch(err => {
        const error = new KuzzleInternalError('Error while forcing token expiration.');
        error.details = err;

        return Bluebird.reject(error);
      });
  }

  /**
   * Attempts a login with request informations against the provided strategy; local is used if strategy is not provided.
   *
   * @param {Request} request
   * @returns {Promise<Token>}
   */
  login(request) {
    assertHasBody(request);

    const strategy = request.input.body.strategy || 'local';

    return this.kuzzle.passport.authenticate({query: request.input.body, original: request}, strategy)
      .then(userObject => {
        const options = {};
        if (!userObject.headers) {
          if (request.input.body.expiresIn) {
            options.expiresIn = request.input.body.expiresIn;
          }
          return this.kuzzle.repositories.token.generateToken(userObject, request, options);
        }

        return Bluebird.resolve(userObject);
      })
      .then(response => {
        if (response instanceof Token) {
          return Bluebird.resolve({
            _id: response.userId,
            jwt: response._id
          });
        }

        return response;
      });
  }

  /**
   * Returns the user identified by the given jwt token
   *
   * @param {Request} request
   * @returns {Promise<object>}
   */
  getCurrentUser(request) {
    let formattedUser;

    return formatProcessing.formatUserForSerialization(this.kuzzle, request.context.user)
      .then(result => {
        const
          availableStrategies = this.kuzzle.pluginsManager.listStrategies(),
          promises = [];

        formattedUser = result;
        
        if (this.kuzzle.repositories.user.anonymous()._id === request.context.token.userId) {
          return Promise.resolve([]);
        }

        for (let i = 0; i < availableStrategies.length; i++) {
          const
            strategy = availableStrategies[i],
            existsMethod = this.kuzzle.pluginsManager.getStrategyMethod(strategy, 'exists');

          promises.push(
            existsMethod(request, request.context.token.userId, strategy)
              .then(exists => exists ? strategy : null)
          );
        }

        return Bluebird.all(promises);
      })
      .then(strategies => {
        if (strategies.length > 0) {
          formattedUser.strategies = strategies.filter(item => item !== null);
        }

        return formattedUser;
      });
  }

  /**
   * Returns the rights of the user identified by the given jwt token
   *
   * @param {Request} request
   * @returns {Promise<object>}
   */
  getMyRights(request) {
    return request.context.user.getRights(this.kuzzle)
      .then(rights => Object.keys(rights).reduce((array, item) => array.concat(rights[item]), []))
      .then(rights => Bluebird.resolve({hits: rights, total: rights.length}));
  }

  /**
   * Checks the validity of a token.
   *
   * @param {Request} request
   * @returns {Promise<object>}
   */
  checkToken(request) {
    assertHasBody(request);
    assertBodyHasAttribute(request, 'token');

    return this.kuzzle.repositories.token.verifyToken(request.input.body.token)
      .then(token => Bluebird.resolve({valid: true, expiresAt: token.expiresAt}))
      .catch(invalid => {
        if (invalid.status === 401) {
          return Bluebird.resolve({valid: false, state: invalid.message});
        }

        return Bluebird.reject(invalid);
      });
  }

  /**
   * Updates the current user if it is not anonymous
   *
   * @param {Request} request
   * @returns {Promise<object>}
   */
  updateSelf(request) {
    assertIsConnected(this.kuzzle, request);
    assertHasBody(request);
    assertBodyHasNotAttribute(request, '_id');
    assertBodyHasNotAttribute(request, 'profileIds');

    return this.kuzzle.repositories.user.persist(_.extend(request.context.user, request.input.body), {database: {method: 'update'}})
      .then(updatedUser => formatProcessing.formatUserForSerialization(this.kuzzle, updatedUser));
  }

  /**
   * List authentication strategies
   *
   * @returns {Promise.<string[]>}
   */
  getStrategies() {
    return Bluebird.resolve(this.kuzzle.pluginsManager.listStrategies());
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  createMyCredentials(request) {
    let
      createMethod,
      validateMethod;

    assertIsConnected(this.kuzzle, request);
    assertHasStrategy(request);
    assertIsStrategyRegistered(this.kuzzle, request);
    assertHasBody(request);


    createMethod = this.kuzzle.pluginsManager.getStrategyMethod(request.input.args.strategy, 'create');
    validateMethod = this.kuzzle.pluginsManager.getStrategyMethod(request.input.args.strategy, 'validate');

    return validateMethod(request, request.input.body, request.context.user._id, request.input.args.strategy, false)
      .then(() => createMethod(request, request.input.body, request.context.user._id, request.input.args.strategy));
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  updateMyCredentials(request) {
    let
      updateMethod,
      validateMethod;

    assertIsConnected(this.kuzzle, request);
    assertHasStrategy(request);
    assertIsStrategyRegistered(this.kuzzle, request);
    assertHasBody(request);

    updateMethod = this.kuzzle.pluginsManager.getStrategyMethod(request.input.args.strategy, 'update');
    validateMethod = this.kuzzle.pluginsManager.getStrategyMethod(request.input.args.strategy, 'validate');

    return validateMethod(request, request.input.body, request.context.user._id, request.input.args.strategy, true)
      .then(() => updateMethod(request, request.input.body, request.context.user._id, request.input.args.strategy));
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  credentialsExist(request) {
    let existsMethod;

    assertIsConnected(this.kuzzle, request);
    assertHasStrategy(request);
    assertIsStrategyRegistered(this.kuzzle, request);

    existsMethod = this.kuzzle.pluginsManager.getStrategyMethod(request.input.args.strategy, 'exists');

    return existsMethod(request, request.context.user._id, request.input.args.strategy);
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  validateMyCredentials(request) {
    let validateMethod;

    assertIsConnected(this.kuzzle, request);
    assertHasStrategy(request);
    assertIsStrategyRegistered(this.kuzzle, request);
    assertHasBody(request);

    validateMethod = this.kuzzle.pluginsManager.getStrategyMethod(request.input.args.strategy, 'validate');

    return validateMethod(request, request.input.body, request.context.user._id, request.input.args.strategy, false);
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  deleteMyCredentials(request) {
    let deleteMethod;

    assertIsConnected(this.kuzzle, request);
    assertHasStrategy(request);
    assertIsStrategyRegistered(this.kuzzle, request);

    deleteMethod = this.kuzzle.pluginsManager.getStrategyMethod(request.input.args.strategy, 'delete');

    return deleteMethod(request, request.context.user._id, request.input.args.strategy)
      .then(() => ({acknowledged: true}));
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  getMyCredentials(request) {
    assertIsConnected(this.kuzzle, request);
    assertHasStrategy(request);
    assertIsStrategyRegistered(this.kuzzle, request);

    if (this.kuzzle.pluginsManager.hasStrategyMethod(request.input.args.strategy, 'getInfo')) {
      const getInfoMethod = this.kuzzle.pluginsManager.getStrategyMethod(request.input.args.strategy, 'getInfo');

      return getInfoMethod(request, request.context.user._id, request.input.args.strategy);
    }

    return Bluebird.resolve({});
  }
}

module.exports = AuthController;
