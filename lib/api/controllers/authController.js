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
  apiErrorsManager = require('../../config/error-codes/throw').wrap('api', 'auth'),
  errorsManager = require('../../config/error-codes/throw'),
  Bluebird = require('bluebird'),
  _ = require('lodash'),
  BaseController = require('./baseController'),
  User = require('../core/models/security/user'),
  formatProcessing = require('../core/auth/formatProcessing'),
  { IncomingMessage } = require('http'),
  { KuzzleError } = require('kuzzle-common-objects').errors,
  {
    assertIsStrategyRegistered,
    assertIsAuthenticated,
    assertHasBody,
    assertHasStrategy,
    assertBodyHasNotAttribute,
    assertArgsHasAttribute,
    assertBodyHasAttribute
  } = require('../../util/requestAssertions');

/**
 * @class AuthController
 * @param {Kuzzle} kuzzle
 */
class AuthController extends BaseController {
  /**
   * @param {Kuzzle} kuzzle
   * @constructor
   */
  constructor(kuzzle) {
    super(kuzzle, [
      'checkToken',
      'createMyCredentials',
      'credentialsExist',
      'deleteMyCredentials',
      'getCurrentUser',
      'getMyCredentials',
      'getMyRights',
      'getStrategies',
      'login',
      'logout',
      'refreshToken',
      'updateMyCredentials',
      'updateSelf',
      'validateMyCredentials'
    ]);

    this.anonymousId = null;
    this.tokenGracePeriod = this.kuzzle.config.security.jwt.gracePeriod / 1000;
  }

  /**
   * Controller initialization: we need the anonymous user identifier for the
   * "isAuthenticated" assertion
   *
   * @return {Promise}
   */
  init() {
    return this.kuzzle.repositories.user.anonymous()
      .then(anonymous => {
        this.anonymousId = anonymous._id;
        return null;
      });
  }

  /**
   * Logs the current user out
   *
   * @param {Request} request
   * @returns {Promise<object>}
   */
  logout(request) {
    assertIsAuthenticated(this.anonymousId, request);

    return this.kuzzle.repositories.token.expire(request.context.token)
      .then(() => ({acknowledged: true}))
      .catch(err => {
        const error = apiErrorsManager.getError('token_force_expire');
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
    assertArgsHasAttribute(request, 'strategy');

    const strategy = request.input.args.strategy;
    const passportRequest = new IncomingMessage();

    // even in http, the url and the method are not pushed back to the request object
    // set some arbitrary values to get a pseudo-valid object.
    passportRequest.url = `/login?strategy=${strategy}`;
    passportRequest.method = 'POST';
    passportRequest.httpVersion = '1.1';
    passportRequest.httpVersionMajor = 1;
    passportRequest.httpVersionMinor = 1;
    passportRequest.body = request.input.body;
    passportRequest.query = request.input.args;
    passportRequest.headers = Object.assign({}, request.input.headers);
    for (const h of Object.keys(passportRequest.headers)) {
      passportRequest.rawHeaders.push(h);
      passportRequest.rawHeaders.push(passportRequest.headers[h]);
    }
    passportRequest.original = request;

    return this.kuzzle.passport.authenticate(passportRequest, strategy)
      .then(content => {
        // do not trigger the "auth:strategyAutenticated" pipe if the result is not a User object,
        // ie. if we are a intermediate step of a multi-step authentication strategy (example: first redirection call for oAuth strategies)
        if (! (content instanceof User)) {
          return {strategy, content};
        }

        return this.kuzzle.pipe(
          'auth:strategyAuthenticated',
          {strategy, content});
      })
      .then(response => {
        if (! (response.content instanceof User)) {
          request.setResult(response.content, {
            status: response.content.statusCode || 200,
            headers: response.content.headers
          });
          return response.content;
        }

        const options = {};
        if (request.input.args.expiresIn) {
          options.expiresIn = request.input.args.expiresIn;
        }

        return this.kuzzle.repositories.token.generateToken(
          response.content, request, options
        )
          .then(token => ({
            _id: token.userId,
            jwt: token.jwt,
            expiresAt: token.expiresAt,
            ttl: token.ttl
          }));
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

    return formatProcessing.formatUserForSerialization(
      this.kuzzle, request.context.user
    )
      .then(result => {
        const
          availableStrategies = this.kuzzle.pluginsManager.listStrategies(),
          promises = [];

        formattedUser = result;

        if (this.kuzzle.repositories.user.anonymous()._id
          === request.context.token.userId
        ) {
          return Bluebird.resolve([]);
        }

        for (const strategy of availableStrategies) {
          const
            existsMethod = this.kuzzle.pluginsManager.getStrategyMethod(
              strategy, 'exists');

          promises.push(
            existsMethod(request, request.context.token.userId, strategy)
              .then(exists => exists ? strategy : null)
              .catch(err => wrapPluginError(err))
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
      .then(rights => Object.keys(rights)
        .reduce((array, item) => array.concat(rights[item]), [])
      )
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
      .then(token => Bluebird.resolve({
        valid: true,
        expiresAt: token.expiresAt
      }))
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
    assertIsAuthenticated(this.anonymousId, request);
    assertHasBody(request);
    assertBodyHasNotAttribute(request, '_id');
    assertBodyHasNotAttribute(request, 'profileIds');

    return this.kuzzle.repositories.user.persist(
      _.extend(
        request.context.user,
        request.input.body),
      {database: {method: 'update'}})
      .then(updatedUser => formatProcessing
        .formatUserForSerialization(this.kuzzle, updatedUser));
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
    assertIsAuthenticated(this.anonymousId, request);
    assertHasStrategy(request);
    assertIsStrategyRegistered(this.kuzzle, request);
    assertHasBody(request);

    const
      createMethod = this.kuzzle.pluginsManager.getStrategyMethod(
        request.input.args.strategy,
        'create'),
      validateMethod = this.kuzzle.pluginsManager.getStrategyMethod(
        request.input.args.strategy,
        'validate');

    return validateMethod(
      request,
      request.input.body,
      request.context.user._id,
      request.input.args.strategy,
      false)
      .then(() => createMethod(
        request,
        request.input.body,
        request.context.user._id,
        request.input.args.strategy)
      )
      .catch(err => wrapPluginError(err));
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  updateMyCredentials(request) {
    assertIsAuthenticated(this.anonymousId, request);
    assertHasStrategy(request);
    assertIsStrategyRegistered(this.kuzzle, request);
    assertHasBody(request);
    const
      updateMethod = this.kuzzle.pluginsManager.getStrategyMethod(
        request.input.args.strategy,
        'update'),
      validateMethod = this.kuzzle.pluginsManager.getStrategyMethod(
        request.input.args.strategy,
        'validate');

    return validateMethod(
      request,
      request.input.body,
      request.context.user._id,
      request.input.args.strategy,
      true
    )
      .then(() => updateMethod(
        request,
        request.input.body,
        request.context.user._id,
        request.input.args.strategy)
      )
      .catch(err => wrapPluginError(err));
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  credentialsExist(request) {
    assertIsAuthenticated(this.anonymousId, request);
    assertHasStrategy(request);
    assertIsStrategyRegistered(this.kuzzle, request);

    const existsMethod = this.kuzzle.pluginsManager.getStrategyMethod(
      request.input.args.strategy,
      'exists');

    return existsMethod(
      request,
      request.context.user._id,
      request.input.args.strategy
    )
      .catch(err => wrapPluginError(err));
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  validateMyCredentials(request) {
    assertIsAuthenticated(this.anonymousId, request);
    assertHasStrategy(request);
    assertIsStrategyRegistered(this.kuzzle, request);
    assertHasBody(request);

    const validateMethod = this.kuzzle.pluginsManager.getStrategyMethod(
      request.input.args.strategy,
      'validate');

    return validateMethod(
      request,
      request.input.body,
      request.context.user._id,
      request.input.args.strategy,
      false
    )
      .catch(err => wrapPluginError(err));
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  deleteMyCredentials(request) {
    assertIsAuthenticated(this.anonymousId, request);
    assertHasStrategy(request);
    assertIsStrategyRegistered(this.kuzzle, request);

    const deleteMethod = this.kuzzle.pluginsManager.getStrategyMethod(
      request.input.args.strategy,
      'delete');

    return deleteMethod(
      request,
      request.context.user._id,
      request.input.args.strategy
    )
      .then(() => ({acknowledged: true}))
      .catch(err => wrapPluginError(err));
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  getMyCredentials(request) {
    assertIsAuthenticated(this.anonymousId, request);
    assertHasStrategy(request);
    assertIsStrategyRegistered(this.kuzzle, request);

    if (this.kuzzle.pluginsManager.hasStrategyMethod(
      request.input.args.strategy,
      'getInfo')) {
      const getInfoMethod = this.kuzzle.pluginsManager.getStrategyMethod(
        request.input.args.strategy,
        'getInfo');

      return getInfoMethod(
        request,
        request.context.user._id,
        request.input.args.strategy
      )
        .catch(err => wrapPluginError(err));
    }

    return Bluebird.resolve({});
  }

  /**
   * @param {Request} request
   */
  refreshToken(request) {
    assertIsAuthenticated(this.anonymousId, request);

    // do not refresh an already refreshed token
    if (request.context.token.refreshed) {
      apiErrorsManager.throw('invalid_token');
    }

    const options = {};
    if (request.input.args.expiresIn) {
      options.expiresIn = request.input.args.expiresIn;
    }

    // we allow a grace period before expiring the current token to allow
    // queued requests to execute, but we immediately forbid
    // any further refreshes on that token to prevent token bombing
    request.context.token.refreshed = true;

    return this.kuzzle.repositories.token.persistToCache(
      request.context.token,
      {ttl: this.tokenGracePeriod})
      .then(() => this.kuzzle.repositories.token.generateToken(
        request.context.user, request, options))
      .then(token => {
        this.kuzzle.tokenManager.refresh(request.context.token, token);

        return {
          _id: token.userId,
          jwt: token.jwt,
          expiresAt: token.expiresAt,
          ttl: token.ttl
        };
      });
  }
}

function wrapPluginError(error) {
  if (!(error instanceof KuzzleError)) {
    errorsManager.throw(
      'plugins',
      'runtime',
      'plugin_error',
      error.message);
  }

  throw error;
}

module.exports = AuthController;
