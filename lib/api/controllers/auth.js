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

const
  errorsManager = require('../../util/errors'),
  { has } = require('../../util/safeObject'),
  Bluebird = require('bluebird'),
  _ = require('lodash'),
  { NativeController } = require('./base'),
  User = require('../../core/models/security/user'),
  formatProcessing = require('../../core/auth/formatProcessing'),
  ApiKey = require('../../core/storage/models/apiKey'),
  { IncomingMessage } = require('http'),
  { KuzzleError } = require('kuzzle-common-objects').errors;

/**
 * @class AuthController
 * @param {Kuzzle} kuzzle
 */
class AuthController extends NativeController {
  /**
   * @param {Kuzzle} kuzzle
   * @constructor
   */
  constructor(kuzzle) {
    super(kuzzle, [
      'checkToken',
      'createApiKey',
      'createMyCredentials',
      'credentialsExist',
      'deleteApiKey',
      'deleteMyCredentials',
      'getCurrentUser',
      'getMyCredentials',
      'getMyRights',
      'getStrategies',
      'login',
      'logout',
      'refreshToken',
      'searchApiKeys',
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
  init () {
    return this.kuzzle.repositories.user.anonymous()
      .then(anonymous => {
        this.anonymousId = anonymous._id;
      });
  }

  /**
   * Creates a new API key for the user
   */
  async createApiKey (request) {
    const
      expiresIn = request.input.args.expiresIn || -1,
      refresh = request.input.args.refresh || 'wait_for',
      apiKeyId = request.input.resource._id || null,
      description = this.getBodyString(request, 'description');

    const
      user = request.context.user,
      connectionId = request.context.connection.id;

    const apiKey = await ApiKey.create(
      user,
      connectionId,
      expiresIn,
      description,
      { apiKeyId, creatorId: user._id, refresh });

    return apiKey.serialize({ includeToken: true });
  }

  /**
   * Search in the user API keys
   */
  async searchApiKeys (request) {
    const
      query = this.getBody(request, {}),
      { from, size } = this.getSearchParams(request);

    const
      user = request.context.user,
      searchBody = {
        query: {
          bool: {
            filter: { bool: { must: { term: { userId: user._id } } } },
            must: _.isEmpty(query) ? { match_all: {} } : query
          }
        }
      };

    const apiKeys = await ApiKey.search(searchBody, { from, size });

    return {
      hits: apiKeys.map(apiKey => apiKey.serialize()),
      total: apiKeys.length
    };
  }

  /**
   * Deletes an API key
   */
  async deleteApiKey (request) {
    const
      apiKeyId = this.getId(request),
      refresh = request.input.args.refresh;

    const apiKey = await ApiKey.load(request.context.user._id, apiKeyId);

    await apiKey.delete({ refresh });

    return { _id: apiKeyId };
  }

  /**
   * Logs the current user out
   *
   * @param {Request} request
   * @returns {Promise<object>}
   */
  logout (request) {
    this.assertIsAuthenticated(request);

    const promise = this.getBoolean(request, 'global')
      ? this.kuzzle.repositories.token.deleteByUserId(request.context.user._id)
      : this.kuzzle.repositories.token.expire(request.context.token);

    return promise.then(() => ({acknowledged: true}));
  }

  /**
   * Attempts a login with request informations against the provided strategy;
   * local is used if strategy is not provided.
   *
   * @param {Request} request
   * @returns {Promise<Token>}
   */
  login (request) {
    const
      strategy = this.getString(request, 'strategy'),
      passportRequest = new IncomingMessage();

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

    if (!has(this.kuzzle.pluginsManager.strategies, strategy)) {
      throw errorsManager.get(
        'security',
        'credentials',
        'unknown_strategy',
        strategy);
    }

    return this.kuzzle.passport.authenticate(passportRequest, strategy)
      .then(content => {
        // do not trigger the "auth:strategyAutenticated" pipe if the result is
        // not a User object, i.e. if we are a intermediate step of a multi-step
        // authentication strategy
        // (example: first redirection call for oAuth strategies)
        if (! (content instanceof User)) {
          return {content, strategy};
        }

        return this.kuzzle.pipe(
          'auth:strategyAuthenticated',
          {content, strategy});
      })
      .then(response => {
        if (! (response.content instanceof User)) {
          request.setResult(response.content, {
            headers: response.content.headers,
            status: response.content.statusCode || 200
          });
          return response.content;
        }

        const options = {};
        if (request.input.args.expiresIn) {
          options.expiresIn = request.input.args.expiresIn;
        }

        return this.kuzzle.repositories.token
          .generateToken(response.content, request.context.connection.id, options)
          .then(token => {
            const existingToken = this.kuzzle.tokenManager.getConnectedUserToken(
              response.content._id,
              request.context.connection.id);

            if (existingToken) {
              this.kuzzle.tokenManager.refresh(existingToken, token);
            }

            return {
              _id: token.userId,
              expiresAt: token.expiresAt,
              jwt: token.jwt,
              ttl: token.ttl
            };
          });
      });
  }

  /**
   * Returns the user identified by the given jwt token
   *
   * @param {Request} request
   * @returns {Promise<Object>}
   */
  getCurrentUser (request) {
    const
      userId = request.context.token.userId,
      formattedUser = formatProcessing.serializeUser(request.context.user),
      promises = [];

    if (this.anonymousId === userId) {
      promises.push(Bluebird.resolve([]));
    }
    else {
      for (const strategy of this.kuzzle.pluginsManager.listStrategies()) {
        const existsMethod = this.kuzzle.pluginsManager.getStrategyMethod(
          strategy,
          'exists');

        promises.push(
          existsMethod(request, userId, strategy)
            .then(exists => exists ? strategy : null)
            .catch(err => wrapPluginError(err)));
      }
    }

    return Bluebird.all(promises)
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
  getMyRights (request) {
    return request.context.user.getRights(this.kuzzle)
      .then(rights => Object.keys(rights)
        .reduce((array, item) => array.concat(rights[item]), [])
      )
      .then(rights => ({ hits: rights, total: rights.length }));
  }

  /**
   * Checks the validity of a token.
   *
   * @param {Request} request
   * @returns {Promise<object>}
   */
  checkToken (request) {
    const token = this.getBodyString(request, 'token');

    return this.kuzzle.repositories.token.verifyToken(token)
      .then(({ expiresAt }) => ({
        expiresAt,
        valid: true
      }))
      .catch(error => {
        if (error.status === 401) {
          return { state: error.message, valid: false };
        }

        throw error;
      });
  }

  /**
   * Updates the current user if it is not anonymous
   *
   * @param {Request} request
   * @returns {Promise<object>}
   */
  updateSelf (request) {
    this.assertIsAuthenticated(request);
    this.assertBodyHasNotAttributes(request, '_id', 'profileIds');

    const userContent = this.getBody(request);

    return this.kuzzle.repositories.user
      .persist(
        _.extend(request.context.user, userContent),
        {database: {method: 'update'}})
      .then(updatedUser => formatProcessing.serializeUser(updatedUser));
  }

  /**
   * List authentication strategies
   *
   * @returns {Promise.<string[]>}
   */
  getStrategies () {
    return Bluebird.resolve(this.kuzzle.pluginsManager.listStrategies());
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  createMyCredentials (request) {
    this.assertIsAuthenticated(request);

    const
      userId = this.getUserId(request),
      strategy = this.getString(request, 'strategy'),
      credentials = this.getBody(request);

    this.assertIsStrategyRegistered(strategy);

    const
      createMethod = this.kuzzle.pluginsManager.getStrategyMethod(
        strategy,
        'create'),
      validateMethod = this.kuzzle.pluginsManager.getStrategyMethod(
        strategy,
        'validate');

    return validateMethod(request, credentials, userId, strategy, false)
      .then(() => createMethod(request, credentials, userId, strategy))
      .catch(err => wrapPluginError(err));
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  updateMyCredentials (request) {
    this.assertIsAuthenticated(request);

    const
      userId = this.getUserId(request),
      strategy = this.getString(request, 'strategy'),
      credentials = this.getBody(request);

    this.assertIsStrategyRegistered(strategy);

    const
      updateMethod = this.kuzzle.pluginsManager.getStrategyMethod(
        request.input.args.strategy,
        'update'),
      validateMethod = this.kuzzle.pluginsManager.getStrategyMethod(
        request.input.args.strategy,
        'validate');

    return validateMethod(request, credentials, userId, strategy, true)
      .then(() => updateMethod(request, credentials, userId, strategy))
      .catch(err => wrapPluginError(err));
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  credentialsExist (request) {
    this.assertIsAuthenticated(request);

    const
      userId = this.getUserId(request),
      strategy = this.getString(request, 'strategy');

    this.assertIsStrategyRegistered(strategy);

    const existsMethod = this.kuzzle.pluginsManager.getStrategyMethod(
      strategy,
      'exists');

    return existsMethod(request, userId, strategy)
      .catch(err => wrapPluginError(err));
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  validateMyCredentials (request) {
    this.assertIsAuthenticated(request);

    const
      userId = this.getUserId(request),
      strategy = this.getString(request, 'strategy'),
      credentials = this.getBody(request);

    this.assertIsStrategyRegistered(strategy);

    const validateMethod = this.kuzzle.pluginsManager.getStrategyMethod(
      strategy,
      'validate');

    return validateMethod(request, credentials, userId, strategy, false)
      .catch(err => wrapPluginError(err));
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  deleteMyCredentials (request) {
    this.assertIsAuthenticated(request);

    const
      userId = this.getUserId(request),
      strategy = this.getString(request, 'strategy');

    this.assertIsStrategyRegistered(strategy);

    const deleteMethod = this.kuzzle.pluginsManager.getStrategyMethod(
      strategy,
      'delete');

    return deleteMethod(request, userId, strategy)
      .then(() => ({ acknowledged: true }))
      .catch(err => wrapPluginError(err));
  }

  /**
   * @param {Request} request
   * @returns {Promise.<Object>}
   */
  getMyCredentials (request) {
    this.assertIsAuthenticated(request);

    const
      userId = this.getUserId(request),
      strategy = this.getString(request, 'strategy');

    this.assertIsStrategyRegistered(strategy);

    if (! this.kuzzle.pluginsManager.hasStrategyMethod(strategy, 'getInfo')) {
      return Bluebird.resolve({});
    }

    const getInfoMethod = this.kuzzle.pluginsManager.getStrategyMethod(
      strategy,
      'getInfo');

    return getInfoMethod(request, userId, strategy)
      .catch(err => wrapPluginError(err));
  }

  /**
   * @param {Request} request
   */
  refreshToken (request) {
    this.assertIsAuthenticated(request);

    // do not refresh an already refreshed token
    if (request.context.token.refreshed) {
      throw errorsManager.get('security', 'token', 'invalid');
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
      { ttl: this.tokenGracePeriod })
      .then(() => this.kuzzle.repositories.token.generateToken(
        request.context.user, request.context.connection.id, options))
      .then(token => {
        this.kuzzle.tokenManager.refresh(request.context.token, token);

        return {
          _id: token.userId,
          expiresAt: token.expiresAt,
          jwt: token.jwt,
          ttl: token.ttl
        };
      });
  }

  assertIsAuthenticated (request) {
    if (request.context.user._id === this.anonymousId) {
      throw errorsManager.get(
        'security',
        'rights',
        'unauthorized');
    }
  }
}

function wrapPluginError(error) {
  if (!(error instanceof KuzzleError)) {
    throw errorsManager.getFrom(
      error,
      'plugin',
      'runtime',
      'unexpected_error',
      error.message);
  }

  throw error;
}

module.exports = AuthController;
