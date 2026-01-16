/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2022 Kuzzle
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
import { IncomingMessage } from "node:http";
import * as Cookie from "cookie";

import Bluebird from "bluebird";
import { isEmpty } from "lodash";

import { KuzzleError } from "../../kerror/errors";
import { KuzzleRequest } from "../request";
import * as kerror from "../../kerror";
import { has } from "../../util/safeObject";
import { NativeController } from "./baseController";
import formatProcessing from "../../core/auth/formatProcessing";
import { User } from "../../model/security/user";
import ApiKey from "../../model/storage/apiKey";
import SecurityController from "./securityController";
import { JSONObject } from "kuzzle-sdk";
import { Token } from "../../model/security/token";

import type { GetCurrentUserResponse } from "../../types/controllers/authController.type";

const securityError = kerror.wrap("security", "token");

export default class AuthController extends NativeController {
  private anonymousId: string | null = null;
  private readonly logger = globalThis.kuzzle.log.child("api:controllers:auth");

  /**
   * @param {Kuzzle} kuzzle
   * @constructor
   */
  constructor() {
    super([
      "checkRights",
      "checkToken",
      "createApiKey",
      "createMyCredentials",
      "createToken",
      "credentialsExist",
      "deleteApiKey",
      "deleteMyCredentials",
      "getCurrentUser",
      "getMyCredentials",
      "getMyRights",
      "getStrategies",
      "login",
      "logout",
      "refreshToken",
      "searchApiKeys",
      "updateMyCredentials",
      "updateSelf",
      "validateMyCredentials",
    ]);
  }

  /**
   * Controller initialization: we need the anonymous user identifier for the
   * "isAuthenticated" assertion
   *
   * @returns {Promise}
   */
  async init(): Promise<any> {
    const anonymous = await globalThis.kuzzle.ask(
      "core:security:user:anonymous:get",
    );
    this.anonymousId = anonymous._id;
  }

  async createToken(request: KuzzleRequest) {
    const singleUse = request.getBoolean("singleUse");

    if (`${request.input.args.expiresIn}` === "-1") {
      throw kerror.get(
        "security",
        "token",
        "invalid_expiration",
        "expiresIn",
        "cannot be infinite",
      );
    }

    const token: Token = await this.ask(
      "core:security:token:create",
      request.getUser(),
      {
        expiresIn: request.input.args.expiresIn,
        singleUse,
      },
    );

    return {
      expiresAt: token.expiresAt,
      singleUse: token.singleUse,
      token: token.jwt,
      ttl: token.ttl,
    };
  }

  /**
   * Checks if an API action can be executed by the current user
   */
  async checkRights(request: KuzzleRequest) {
    const requestPayload = request.getBody();

    if (typeof requestPayload.controller !== "string") {
      throw kerror.get("api", "assert", "missing_argument", "body.controller");
    }

    if (typeof requestPayload.action !== "string") {
      throw kerror.get("api", "assert", "missing_argument", "body.action");
    }

    const user = request.context.user;

    const allowed = await user.isActionAllowed(
      new KuzzleRequest(requestPayload),
    );

    return {
      allowed,
    };
  }

  /**
   * Creates a new API key for the user
   * @param {KuzzleRequest} request
   */
  async createApiKey(request: KuzzleRequest) {
    const expiresIn = request.input.args.expiresIn || -1;
    const refresh = request.getRefresh("wait_for");
    const apiKeyId = request.getId({ ifMissing: "generate" });
    const description = request.getBodyString("description");

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
  async searchApiKeys(request: KuzzleRequest) {
    let query = request.getBody({});
    const { from, size } = request.getSearchParams();
    const lang = request.getLangParam();

    const user = request.context.user;

    if (lang === "koncorde") {
      query = await this.translateKoncorde(query);
    }

    const searchBody = {
      query: {
        bool: {
          filter: { bool: { must: { term: { userId: user._id } } } },
          must: isEmpty(query) ? { match_all: {} } : query,
        },
      },
    };

    const apiKeys = await ApiKey.search(searchBody, { from, size });

    return {
      hits: apiKeys.map((apiKey) => apiKey.serialize()),
      total: apiKeys.length,
    };
  }

  /**
   * Deletes an API key
   */
  async deleteApiKey(request: KuzzleRequest) {
    const apiKeyId = request.getId();
    const refresh = request.getRefresh();

    const apiKey = await ApiKey.load(request.context.user._id, apiKeyId);

    await apiKey.delete({ refresh });

    return { _id: apiKeyId };
  }

  /**
   * Logs the current user out
   *
   * @param {KuzzleRequest} request
   * @returns {Promise<object>}
   */
  async logout(request: KuzzleRequest): Promise<object> {
    if (
      !globalThis.kuzzle.config.http.cookieAuthentication ||
      !request.getBoolean("cookieAuth")
    ) {
      this.assertIsAuthenticated(request);
    }

    if (
      globalThis.kuzzle.config.internal.notifiableProtocols.includes(
        request.context.connection.protocol,
      )
    ) {
      // Unlink connection so the connection will not be notified when the token expires.
      globalThis.kuzzle.tokenManager.unlink(
        request.context.token,
        request.context.connection.id,
      );
    }

    if (request.context.user._id !== this.anonymousId) {
      if (request.getBoolean("global")) {
        await globalThis.kuzzle.ask(
          "core:security:token:deleteByKuid",
          request.getKuid(),
          { keepApiKeys: true },
        );
      } else if (
        request.context.token &&
        request.context.token.type !== "apiKey"
      ) {
        await globalThis.kuzzle.ask(
          "core:security:token:delete",
          request.context.token,
        );
      }
    }

    if (
      globalThis.kuzzle.config.http.cookieAuthentication &&
      request.getBoolean("cookieAuth")
    ) {
      request.response.configure({
        headers: {
          "Set-Cookie": Cookie.serialize("authToken", null, {
            httpOnly: true,
            path: "/",
            sameSite: "strict",
          }),
        },
      });
    }

    return { acknowledged: true };
  }

  // Used to send the Token using different ways when in cookieAuth mode. (DRY)
  async _sendToken(token: Token, request: KuzzleRequest): Promise<Token> {
    const tokenResponse: any = {
      _id: token.userId,
      expiresAt: token.expiresAt,
      jwt: token.jwt,
      ttl: token.ttl,
    };

    // Only if the support of Browser Cookie as Authentication Token is enabled
    // otherwise we should send a normal response because
    // even if the SDK / Browser can handle the cookie,
    // Kuzzle would not be capable of doing anything with it
    if (
      globalThis.kuzzle.config.http.cookieAuthentication &&
      request.getBoolean("cookieAuth")
    ) {
      // Here we are not sending auth token when cookieAuth is set to true
      // This allow us to detect if kuzzle does support cookie as auth token directly from the SDK
      // or that the version of kuzzle doesn't support the feature Browser Cookie as Authentication Token

      request.response.configure({
        headers: {
          "Set-Cookie": Cookie.serialize("authToken", token.jwt, {
            expires: new Date(token.expiresAt),
            httpOnly: true,
            path: "/",
            sameSite: "strict",
          }),
        },
      });
      delete tokenResponse.jwt;
    }

    return tokenResponse;
  }

  /**
   * Attempts a login with request informations against the provided strategy;
   * local is used if strategy is not provided.
   *
   * @param {KuzzleRequest} request
   * @returns {Promise<Token>}
   */
  async login(request: KuzzleRequest): Promise<Token> {
    const strategy = request.getString("strategy");
    const passportRequest: any = new IncomingMessage(null);

    // Even in http, the url and the method are not pushed back to the request object
    // set some arbitrary values to get a pseudo-valid object.
    passportRequest.url = `/login?strategy=${strategy}`;
    passportRequest.method = "POST";
    passportRequest.httpVersion = "1.1";
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

    if (!has(globalThis.kuzzle.pluginsManager.strategies, strategy)) {
      throw kerror.get("security", "credentials", "unknown_strategy", strategy);
    }

    const content = await globalThis.kuzzle.passport.authenticate(
      passportRequest,
      strategy,
    );

    // do not trigger the "auth:strategyAutenticated" pipe if the result is
    // not a User object, i.e. if we are a intermediate step of a multi-step
    // authentication strategy
    // (example: first redirection call for oAuth strategies)
    const authResponse = !(content instanceof User)
      ? { content, strategy }
      : await this.pipe("auth:strategyAuthenticated", { content, strategy });

    if (!(authResponse.content instanceof User)) {
      request.response.configure({
        headers: authResponse.content.headers,
        status: authResponse.content.statusCode || 200,
      });

      return authResponse.content;
    }

    const options: JSONObject = {};
    if (request.input.args.expiresIn) {
      options.expiresIn = request.input.args.expiresIn;
    }

    const existingToken = globalThis.kuzzle.tokenManager.getConnectedUserToken(
      authResponse.content._id,
      request.context.connection.id,
    );

    /**
     * If a previous token from the same User is linked to this connection
     * and the token is either an API Key or an infinite duration token
     * we dont need to create a new token or refresh anything, just send back the exact same token
     * to avoid breaking changes.
     */
    if (
      existingToken &&
      (existingToken.type === "apiKey" || existingToken.ttl < 0)
    ) {
      return this._sendToken(existingToken, request);
    }

    const token = await this.ask(
      "core:security:token:create",
      authResponse.content,
      options,
    );

    if (existingToken) {
      globalThis.kuzzle.tokenManager.refresh(existingToken, token);
    }

    if (
      globalThis.kuzzle.config.internal.notifiableProtocols.includes(
        request.context.connection.protocol,
      )
    ) {
      // Link the connection with the token, this way the connection can be notified when the token has expired.
      globalThis.kuzzle.tokenManager.link(token, request.context.connection.id);
    }

    return this._sendToken(token, request);
  }

  /**
   * Returns the user identified by the given jwt token
   *
   * @param {KuzzleRequest} request
   * @returns {Promise<Object>}
   */
  async getCurrentUser(request: KuzzleRequest): Promise<object> {
    const promises = [];
    const userId = request.context.token.userId;
    const formattedUser: GetCurrentUserResponse = {
      ...formatProcessing.serializeUser(request.context.user),
      strategies: [],
    };

    if (this.anonymousId === userId) {
      promises.push(Bluebird.resolve([]));
    } else {
      for (const strategy of globalThis.kuzzle.pluginsManager.listStrategies()) {
        const existsMethod = globalThis.kuzzle.pluginsManager.getStrategyMethod(
          strategy,
          "exists",
        );

        promises.push(
          existsMethod(request, userId, strategy)
            .then((exists) => (exists ? strategy : null))
            .catch((err) => wrapPluginError(err)),
        );
      }
    }

    const strategies = await Bluebird.all(promises);

    if (strategies.length > 0) {
      formattedUser.strategies = strategies.filter((item) => item !== null);
    }

    return formattedUser;
  }

  /**
   * Returns the rights of the user identified by the given jwt token
   *
   * @param {KuzzleRequest} request
   * @returns {Promise<object>}
   */
  getMyRights(request: KuzzleRequest): Promise<object> {
    return request.context.user
      .getRights()
      .then((rights) =>
        Object.keys(rights).reduce(
          (array, item) => array.concat(rights[item]),
          [],
        ),
      )
      .then((rights) => ({ hits: rights, total: rights.length }));
  }

  /**
   * Checks the validity of a token.
   *
   * @param {KuzzleRequest} request
   * @returns {Promise<object>}
   */
  async checkToken(request) {
    let token = "";

    if (
      globalThis.kuzzle.config.http.cookieAuthentication &&
      request.getBoolean("cookieAuth")
    ) {
      token = request.input.jwt;
    } else {
      token = request.getBodyString("token", "") || null;
    }

    try {
      const { expiresAt = -1, userId } = await this.ask(
        "core:security:token:verify",
        token,
      );

      return { expiresAt, kuid: userId, valid: true };
    } catch (error) {
      if (error.status === 401) {
        return { state: error.message, valid: false };
      }

      throw error;
    }
  }

  /**
   * Updates the current user if it is not anonymous
   *
   * @param {KuzzleRequest} request
   * @returns {Promise<object>}
   */
  async updateSelf(request) {
    this.assertIsAuthenticated(request);
    this.assertBodyHasNotAttributes(request, "_id", "profileIds");

    const userId = request.getKuid();
    const body = request.getBody();

    const user = await this.ask(
      "core:security:user:update",
      userId,
      null,
      body,
      {
        refresh: request.getRefresh("wait_for"),
        retryOnConflict: request.getInteger("retryOnConflict", 10),
        userId,
      },
    );

    this.logger.info(
      `[SECURITY] ${SecurityController.userOrSdk(userId)} applied action "${
        request.input.action
      }" on user "${userId}."`,
    );

    return formatProcessing.serializeUser(user);
  }

  /**
   * List authentication strategies
   *
   * @returns {Promise.<string[]>}
   */
  getStrategies() {
    return Bluebird.resolve(globalThis.kuzzle.pluginsManager.listStrategies());
  }

  /**
   * @param {KuzzleRequest} request
   * @returns {Promise.<Object>}
   */
  createMyCredentials(request) {
    this.assertIsAuthenticated(request);

    const userId = request.getKuid(),
      strategy = request.getString("strategy"),
      credentials = request.getBody();

    this.assertIsStrategyRegistered(strategy);

    const createMethod = globalThis.kuzzle.pluginsManager.getStrategyMethod(
        strategy,
        "create",
      ),
      validateMethod = globalThis.kuzzle.pluginsManager.getStrategyMethod(
        strategy,
        "validate",
      );

    return validateMethod(request, credentials, userId, strategy, false)
      .then(() => createMethod(request, credentials, userId, strategy))
      .catch((err) => wrapPluginError(err));
  }

  /**
   * @param {KuzzleRequest} request
   * @returns {Promise.<Object>}
   */
  updateMyCredentials(request) {
    this.assertIsAuthenticated(request);

    const userId = request.getKuid(),
      strategy = request.getString("strategy"),
      credentials = request.getBody();

    this.assertIsStrategyRegistered(strategy);

    const updateMethod = globalThis.kuzzle.pluginsManager.getStrategyMethod(
        request.input.args.strategy,
        "update",
      ),
      validateMethod = globalThis.kuzzle.pluginsManager.getStrategyMethod(
        request.input.args.strategy,
        "validate",
      );

    return validateMethod(request, credentials, userId, strategy, true)
      .then(() => updateMethod(request, credentials, userId, strategy))
      .catch((err) => wrapPluginError(err));
  }

  /**
   * @param {KuzzleRequest} request
   * @returns {Promise.<Object>}
   */
  credentialsExist(request) {
    this.assertIsAuthenticated(request);

    const userId = request.getKuid(),
      strategy = request.getString("strategy");

    this.assertIsStrategyRegistered(strategy);

    const existsMethod = globalThis.kuzzle.pluginsManager.getStrategyMethod(
      strategy,
      "exists",
    );

    return existsMethod(request, userId, strategy).catch((err) =>
      wrapPluginError(err),
    );
  }

  /**
   * @param {KuzzleRequest} request
   * @returns {Promise.<Object>}
   */
  validateMyCredentials(request) {
    this.assertIsAuthenticated(request);

    const userId = request.getKuid(),
      strategy = request.getString("strategy"),
      credentials = request.getBody();

    this.assertIsStrategyRegistered(strategy);

    const validateMethod = globalThis.kuzzle.pluginsManager.getStrategyMethod(
      strategy,
      "validate",
    );

    return validateMethod(request, credentials, userId, strategy, false).catch(
      (err) => wrapPluginError(err),
    );
  }

  /**
   * @param {KuzzleRequest} request
   * @returns {Promise.<Object>}
   */
  deleteMyCredentials(request) {
    this.assertIsAuthenticated(request);

    const userId = request.getKuid(),
      strategy = request.getString("strategy");

    this.assertIsStrategyRegistered(strategy);

    const deleteMethod = globalThis.kuzzle.pluginsManager.getStrategyMethod(
      strategy,
      "delete",
    );

    return deleteMethod(request, userId, strategy)
      .then(() => ({ acknowledged: true }))
      .catch((err) => wrapPluginError(err));
  }

  /**
   * @param {KuzzleRequest} request
   * @returns {Promise.<Object>}
   */
  getMyCredentials(request) {
    this.assertIsAuthenticated(request);

    const userId = request.getKuid(),
      strategy = request.getString("strategy");

    this.assertIsStrategyRegistered(strategy);

    if (
      !globalThis.kuzzle.pluginsManager.hasStrategyMethod(strategy, "getInfo")
    ) {
      return Bluebird.resolve({});
    }

    const getInfoMethod = globalThis.kuzzle.pluginsManager.getStrategyMethod(
      strategy,
      "getInfo",
    );

    return getInfoMethod(request, userId, strategy).catch((err) =>
      wrapPluginError(err),
    );
  }

  /**
   * @param {KuzzleRequest} request
   */
  async refreshToken(request) {
    this.assertIsAuthenticated(request);
    const strategy = request.input.args?.strategy;
    let expiresIn = request.input.args?.expiresIn;

    if (strategy && strategy !== "local") {
      /**
       * Local strategy is a specific one that is meant to end the core of kuzzle
       * For now we avoid entering here if someone mistakenly specify the "local" strategy
       * // TODO remove this && strategy !== "local" condition once we properly removed the auth local plugin
       */
      try {
        const refreshTokenMethod =
          globalThis.kuzzle.pluginsManager.getStrategyMethod(
            strategy,
            "refreshToken",
          );

        const result = await refreshTokenMethod(request);

        expiresIn = result?.expiresIn || expiresIn;
      } catch (err) {
        /**
         * Every strategies does not implement a standard way of returning errors.
         * Which mean we cannot properly catch any errors in the catch block.
         * Meaning if we arrive here, the refresh token did not work as planned
         * We can safely ensure that the user refresh token is not active anymore
         */
        this.logger.error(
          `Error while refreshing the token with the strategy ${strategy} with ERROR: ${err}`,
        );

        // Adding some debug information to better known our target here.
        this.logger.debug(
          `Error when refreshing token with request: ${JSON.stringify(request)}`,
        );

        throw securityError.get("refresh_forbidden", request.context.token.jwt);
      }
    }

    const token = await this.ask(
      "core:security:token:refresh",
      request.context.user,
      request.context.token,
      expiresIn,
    );

    return this._sendToken(token, request);
  }

  assertIsAuthenticated(request) {
    if (request.context.user._id === this.anonymousId) {
      throw kerror.get(
        "security",
        "rights",
        "unauthorized",
        request.input.controller,
        request.input.action,
      );
    }
  }
}

function wrapPluginError(error) {
  if (!(error instanceof KuzzleError)) {
    throw kerror.getFrom(
      error,
      "plugin",
      "runtime",
      "unexpected_error",
      error.message,
    );
  }

  throw error;
}
