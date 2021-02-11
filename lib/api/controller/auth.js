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

const { IncomingMessage } = require('http');
const Cookie = require('cookie');

const Bluebird = require('bluebird');
const { isEmpty } = require('lodash');

const { KuzzleError } = require('../../kerror/errors');
const { Request } = require('../../api/request');
const kerror = require('../../kerror');
const { has } = require('../../util/safeObject');
const { NativeController, ifMissingEnum } = require('./base');
const formatProcessing = require('../../core/auth/formatProcessing');
const User = require('../../model/security/user');
const ApiKey = require('../../model/storage/apiKey');

/**
 * @class AuthController
 */
class AuthController extends NativeController {
  /**
   * @param {Kuzzle} kuzzle
   * @constructor
   */
  constructor() {
    super([
      'checkRights',
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
      'validateMyCredentials',
    ]);

    this.anonymousId = null;
  }

  /**
   * Controller initialization: we need the anonymous user identifier for the
   * "isAuthenticated" assertion
   *
   * @returns {Promise}
   */
  async init () {
    const anonymous = await global.kuzzle.ask('core:security:user:anonymous:get');
    this.anonymousId = anonymous._id;
  }

  /**
   * Checks if an API action can be executed by the current user
   */
  async checkRights (request) {
    const requestPayload = this.getBody(request);

    if (typeof requestPayload.controller !== 'string') {
      throw kerror.get('api', 'assert', 'missing_argument', 'body.controller');
    }

    if (typeof requestPayload.action !== 'string') {
      throw kerror.get('api', 'assert', 'missing_argument', 'body.action');
    }

    const user = request.context.user;

    const allowed = await user.isActionAllowed(new Request(requestPayload));

    return {
      allowed
    };
  }

  /**
   * Creates a new API key for the user
   */
  async createApiKey (request) {
    const expiresIn = request.input.args.expiresIn || -1;
    const refresh = this.getRefresh(request, 'wait_for');
    const apiKeyId = this.getId(request, ifMissingEnum.IGNORE);
    const description = this.getBodyString(request, 'description');

    const user = request.context.user;

    const apiKey = await ApiKey.create(user, expiresIn, description, {
      apiKeyId,
      creatorId: user._id,
      refresh,
    });

    return apiKey.serialize({ includeToken: true });
  }

  /**
   * Search in the user API keys
   */
  async searchApiKeys (request) {
    let query = this.getBody(request, {});
    const { from, size } = this.getSearchParams(request);
    const lang = this.getLangParam(request);

    const user = request.context.user;

    if (lang === 'koncorde') {
      query = await this.translateKoncorde(query);
    }

    const searchBody = {
      query: {
        bool: {
          filter: { bool: { must: { term: { userId: user._id } } } },
          must: isEmpty(query) ? { match_all: {} } : query
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
  async logout (request) {
    this.assertIsAuthenticated(request);

    if (this.getBoolean(request, 'global')) {
      await global.kuzzle.ask(
        'core:security:token:deleteByKuid',
        this.getUserId(request));
    }
    else {
      await global.kuzzle.ask(
        'core:security:token:delete',
        request.context.token);
    }

    if ( global.kuzzle.config.security.supportCookieAuthentication
      && request.input.args.cookieOnly
    ) {
      request.setResult(null,
        {
          headers: {
            'Set-Cookie': Cookie.serialize(
              '__Host-authToken',
              '',
              {
                httpOnly: true,
                path: '/',
                sameSite:'none',
                secure: true,
              }
            )
          }
        });
    }

    return {acknowledged: true};
  }

  // Used to send the Token using different ways when in cookieOnly mode. (DRY)
  async _sendToken(token, request) {
    // Only if the support of Browser Cookie as Authentication Token is enabled
    // otherwise we should send a normal response because
    // even if the SDK / Browser can handle the cookie,
    // Kuzzle would not be capable of doing anything with it
    if ( global.kuzzle.config.security.supportCookieAuthentication
      && request.input.args.cookieOnly
    ) {
      // Here we are not sending auth token when cookieOnly is set to true
      // This allow us to detect if kuzzle does support cookie as auth token directly from the SDK
      // if the response contains the auth token this means that the configuration [security.supportCookieAuthentication] is set to false
      // or that the version of kuzzle doesn't support the feature Browser Cookie as Authentication Token

      request.setResult(null,
        {
          headers: {
            'Set-Cookie': Cookie.serialize(
              '__Host-authToken',
              token.jwt,
              {
                expires: new Date(token.expiresAt),
                httpOnly: true,
                path: '/',
                sameSite:'none',
                secure: true,
              }
            )
          }
        });
      return { 
        _id: token.userId,
        expiresAt: token.expiresAt,
        ttl: token.ttl,  
      };
    }

    return {
      _id: token.userId,
      expiresAt: token.expiresAt,
      jwt: token.jwt,
      ttl: token.ttl
    };
  }

  /**
   * Attempts a login with request informations against the provided strategy;
   * local is used if strategy is not provided.
   *
   * @param {Request} request
   * @returns {Promise<Token>}
   */
  async login (request) {
    const strategy = this.getString(request, 'strategy');
    const passportRequest = new IncomingMessage();

    // Even in http, the url and the method are not pushed back to the request object
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

    if (!has(global.kuzzle.pluginsManager.strategies, strategy)) {
      throw kerror.get('security', 'credentials', 'unknown_strategy', strategy);
    }

    const content = await global.kuzzle.passport.authenticate(
      passportRequest,
      strategy);

    // do not trigger the "auth:strategyAutenticated" pipe if the result is
    // not a User object, i.e. if we are a intermediate step of a multi-step
    // authentication strategy
    // (example: first redirection call for oAuth strategies)
    const authResponse = (! (content instanceof User))
      ? {content, strategy}
      : await this.pipe('auth:strategyAuthenticated', {content, strategy});

    if (! (authResponse.content instanceof User)) {
      request.setResult(authResponse.content, {
        headers: authResponse.content.headers,
        status: authResponse.content.statusCode || 200
      });
      return authResponse.content;
    }

    const options = {};
    if (request.input.args.expiresIn) {
      options.expiresIn = request.input.args.expiresIn;
    }
    const token = await this.ask(
      'core:security:token:create',
      authResponse.content,
      options);
    const existingToken = global.kuzzle.tokenManager.getConnectedUserToken(
      authResponse.content._id,
      request.context.connection.id);

    if (existingToken) {
      global.kuzzle.tokenManager.refresh(existingToken, token);
    }

    return await this._sendToken(token, request);
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
      for (const strategy of global.kuzzle.pluginsManager.listStrategies()) {
        const existsMethod = global.kuzzle.pluginsManager.getStrategyMethod(
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
    return request.context.user.getRights(global.kuzzle)
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
  async checkToken (request) {
    let token = '';

    if ( global.kuzzle.config.security.supportCookieAuthentication 
      && request.input.args.cookieOnly
    ) {
      token = request.input.jwt;
    }
    else {
      token = this.getBodyString(request, 'token');
    }

    try {
      const { expiresAt, userId } = await this.ask('core:security:token:verify', token);

      return { expiresAt, kuid: userId, valid: true };
    }
    catch (error) {
      if (error.status === 401) {
        return { state: error.message, valid: false };
      }

      throw error;
    }
  }

  /**
   * Updates the current user if it is not anonymous
   *
   * @param {Request} request
   * @returns {Promise<object>}
   */
  async updateSelf (request) {
    this.assertIsAuthenticated(request);
    this.assertBodyHasNotAttributes(request, '_id', 'profileIds');

    const userId = this.getUserId(request);
    const body = this.getBody(request);

    const user = await this.ask(
      'core:security:user:update',
      userId,
      null,
      body,
      {
        refresh: this.getRefresh(request, 'wait_for'),
        retryOnConflict: this.getInteger(request, 'retryOnConflict', 10),
        userId,
      });

    global.kuzzle.log.info(`[SECURITY] User "${userId}" applied action "${request.input.action}" on user "${userId}."`);

    return formatProcessing.serializeUser(user);
  }

  /**
   * List authentication strategies
   *
   * @returns {Promise.<string[]>}
   */
  getStrategies () {
    return Bluebird.resolve(global.kuzzle.pluginsManager.listStrategies());
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
      createMethod = global.kuzzle.pluginsManager.getStrategyMethod(
        strategy,
        'create'),
      validateMethod = global.kuzzle.pluginsManager.getStrategyMethod(
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
      updateMethod = global.kuzzle.pluginsManager.getStrategyMethod(
        request.input.args.strategy,
        'update'),
      validateMethod = global.kuzzle.pluginsManager.getStrategyMethod(
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

    const existsMethod = global.kuzzle.pluginsManager.getStrategyMethod(
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

    const validateMethod = global.kuzzle.pluginsManager.getStrategyMethod(
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

    const deleteMethod = global.kuzzle.pluginsManager.getStrategyMethod(
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

    if (! global.kuzzle.pluginsManager.hasStrategyMethod(strategy, 'getInfo')) {
      return Bluebird.resolve({});
    }

    const getInfoMethod = global.kuzzle.pluginsManager.getStrategyMethod(
      strategy,
      'getInfo');

    return getInfoMethod(request, userId, strategy)
      .catch(err => wrapPluginError(err));
  }

  /**
   * @param {Request} request
   */
  async refreshToken (request) {
    this.assertIsAuthenticated(request);

    const token = await this.ask(
      'core:security:token:refresh',
      request.context.user,
      request.context.token,
      request.input.args.expiresIn);

    return await this._sendToken(token, request);
  }

  assertIsAuthenticated (request) {
    if (request.context.user._id === this.anonymousId) {
      throw kerror.get('security', 'rights', 'unauthorized');
    }
  }
}

function wrapPluginError(error) {
  if (!(error instanceof KuzzleError)) {
    throw kerror.getFrom(
      error,
      'plugin',
      'runtime',
      'unexpected_error',
      error.message);
  }

  throw error;
}

module.exports = AuthController;
