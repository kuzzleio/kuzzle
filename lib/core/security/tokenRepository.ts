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

import jwt from "jsonwebtoken";
import { JSONObject } from "kuzzle-sdk";
import _ from "lodash";
import ms from "ms";

import * as kerror from "../../kerror";
import { UnauthorizedError } from "../../kerror/errors";
import { Token } from "../../model/security/token";
import { User } from "../../model/security/user";
import ApiKey from "../../model/storage/apiKey";
import debugFactory from "../../util/debug";
import { ObjectRepository } from "../shared/ObjectRepository";
import { sha256 } from "../../util/crypto";

const securityError = kerror.wrap("security", "token");
const debug = debugFactory("kuzzle:bootstrap:tokens");

const BOOTSTRAP_DONE_KEY = "token/bootstrap";

export class TokenRepository extends ObjectRepository<Token> {
  private tokenGracePeriod: number;
  private anonymousToken: Token;

  constructor(opts: JSONObject = {}) {
    super();

    this.collection = "token";

    this.ObjectConstructor = Token;

    if (opts.ttl !== undefined) {
      this.ttl = opts.ttl;
    }

    this.tokenGracePeriod = Math.floor(
      global.kuzzle.config.security.jwt.gracePeriod,
    );

    this.anonymousToken = new Token({ userId: "-1" });
  }

  async init() {
    /**
     * Assign an existing token to a user. Stores the token in Kuzzle's cache.
     * @param  {String} hash - JWT
     * @param  {String} userId
     * @param  {Number} ttl - token expiration delay
     * @returns {Token}
     */
    global.kuzzle.onAsk("core:security:token:assign", (hash, userId, ttl) =>
      this.persistForUser(hash, userId, { singleUse: false, ttl }),
    );

    /**
     * Creates and assigns a token to a user
     * @param  {User} user
     * @param  {Objects} opts (algorithm, expiresIn, bypassMaxTTL)
     * @returns {Token}
     */
    global.kuzzle.onAsk("core:security:token:create", (user, opts) =>
      this.generateToken(user, opts),
    );

    /**
     * Deletes a token immediately
     * @param  {Token} token
     */
    global.kuzzle.onAsk("core:security:token:delete", (token) =>
      this.expire(token),
    );

    /**
     * Deletes all tokens assigned to the provided user ID.
     * @param  {String} userId
     * @param  {Objects} opts (keepApiKeys)
     */
    global.kuzzle.onAsk("core:security:token:deleteByKuid", (kuid, opts) =>
      this.deleteByKuid(kuid, opts),
    );

    /**
     * Gets a token
     * @param  {String} userId - user identifier
     * @param  {String} hash - JWT
     * @returns {Token}
     */
    global.kuzzle.onAsk("core:security:token:get", (userId, hash) =>
      this.loadForUser(userId, hash),
    );

    /**
     * Refreshes an existing token for the given user.
     * The old token will be kept for a (configurable) grace period, to allow
     * pending requests to finish, but it will be marked as "refreshed" to
     * prevent token duplication.
     *
     * @param  {User} user
     * @param  {Token} token to refresh
     * @param  {String} expiresIn - new token expiration delay
     * @returns {Token} new token
     */
    global.kuzzle.onAsk(
      "core:security:token:refresh",
      (user, token, expiresIn) => this.refresh(user, token, expiresIn),
    );

    /**
     * Verifies if the provided hash is valid, and returns the corresponding
     * Token object
     * @param  {String} hash - JWT
     * @returns {Token}
     */
    global.kuzzle.onAsk("core:security:token:verify", (hash) =>
      this.verifyToken(hash),
    );

    // ? those checks are necessary to detect JWT seed changes and delete existing token if necessary
    const existingTokens = await global.kuzzle.ask(
      "core:cache:internal:searchKeys",
      "repos/kuzzle/token/*",
    );

    if (existingTokens.length > 0) {
      try {
        const [, token] = existingTokens[0].split("#");
        await this.verifyToken(token);
      } catch (e) {
        // ? seed has changed
        if (e.id === "security.token.invalid") {
          await global.kuzzle.ask("core:cache:internal:del", existingTokens);
        }
      }
    }
  }

  /**
   * Expires the given token immediately
   */
  async expire(token: Token) {
    await super.expireFromCache(token);
    await global.kuzzle.tokenManager.expire(token);
  }

  /**
   * We allow a grace period before expiring the token to allow
   * queued requests to execute, but we mark the token as "refreshed" to forbid
   * any refreshes on that token, to prevent token bombing
   *
   * @param user
   * @param requestToken
   * @param expiresIn - new token expiration delay
   */
  async refresh(user: User, token: Token, expiresIn: string): Promise<Token> {
    // do not refresh a token marked as already
    if (token.refreshed) {
      throw securityError.get("invalid");
    }

    // do not refresh API Keys or token that have an infinite TTL
    if (token.type === "apiKey" || token.ttl < 0) {
      throw securityError.get(
        "refresh_forbidden",
        token.type === "apiKey" ? "API Key" : "Token with infinite TTL",
      );
    }

    const refreshed = await this.generateToken(user, { expiresIn });

    // Mark as "refreshed" only if generating the new token succeeds
    token.refreshed = true;
    await this.persistToCache(token, { ttl: this.tokenGracePeriod });

    global.kuzzle.tokenManager.refresh(token, refreshed);

    return refreshed;
  }

  /**
   * @param user
   * @param options - { algorithm, expiresIn, bypassMaxTTL (false), type (authToken) }
   *
   * @returns {Promise.<Object>} { _id, jwt, userId, ttl, expiresAt }
   */
  async generateToken(
    user: User,
    {
      algorithm = global.kuzzle.config.security.authToken.algorithm ??
        global.kuzzle.config.security.jwt.algorithm,
      expiresIn = global.kuzzle.config.security.authToken.expiresIn ??
        global.kuzzle.config.security.jwt.expiresIn,
      bypassMaxTTL = false,
      type = "authToken",
      singleUse = false,
    }: {
      algorithm?: string;
      expiresIn?: string;
      bypassMaxTTL?: boolean;
      type?: string;
      singleUse?: boolean;
    } = {},
  ): Promise<Token> {
    if (!user || user._id === null) {
      throw securityError.get("unknown_user");
    }

    const parsedExpiresIn = parseTimespan(expiresIn);

    const maxTTL =
      type === "apiKey"
        ? global.kuzzle.config.security.apiKey.maxTTL
        : global.kuzzle.config.security.authToken.maxTTL ??
          global.kuzzle.config.security.jwt.maxTTL;

    if (
      !bypassMaxTTL &&
      maxTTL > -1 &&
      (parsedExpiresIn > maxTTL || parsedExpiresIn === -1)
    ) {
      throw securityError.get("ttl_exceeded");
    }

    const signOptions: JSONObject = { algorithm };

    if (parsedExpiresIn === 0) {
      throw kerror.get(
        "api",
        "assert",
        "invalid_argument",
        "expiresIn",
        "a number of milliseconds, or a parsable timespan string",
      );
    }
    // -1 mean infite duration, so we don't pass the expiresIn option to
    // jwt.sign
    else if (parsedExpiresIn !== -1) {
      signOptions.expiresIn = Math.floor(parsedExpiresIn / 1000);
    }

    let encodedToken;
    try {
      encodedToken = jwt.sign(
        { _id: user._id },
        global.kuzzle.secret,
        signOptions,
      );
    } catch (err) {
      throw securityError.getFrom(err, "generation_failed", err.message);
    }

    if (type === "apiKey") {
      encodedToken = Token.APIKEY_PREFIX + encodedToken;

      // For API keys, we don't persist the token
      const expiresAt =
        parsedExpiresIn === -1 ? -1 : Date.now() + parsedExpiresIn;
      return new Token({
        _id: `${user._id}#${encodedToken}`,
        expiresAt,
        jwt: encodedToken,
        ttl: parsedExpiresIn,
        userId: user._id,
      });
    }
    encodedToken = Token.AUTH_PREFIX + encodedToken;

    // Persist regular tokens
    return this.persistForUser(encodedToken, user._id, {
      singleUse,
      ttl: parsedExpiresIn,
    });
  }

  /**
   * Persists a token in the cache
   *
   * @param encodedToken - Encoded token
   * @param userId - User ID
   * @param ttl - TTL in ms (-1 for infinite duration)
   */
  async persistForUser(
    encodedToken: string,
    userId: string,
    {
      ttl,
      singleUse,
    }: {
      ttl: number;
      singleUse: boolean;
    },
  ): Promise<Token> {
    const redisTTL = ttl === -1 ? 0 : ttl;
    const expiresAt = ttl === -1 ? -1 : Date.now() + ttl;
    const token = new Token({
      _id: `${userId}#${encodedToken}`,
      expiresAt,
      jwt: encodedToken,
      singleUse,
      ttl,
      userId,
    });

    try {
      return await this.persistToCache(token, { ttl: redisTTL });
    } catch (err) {
      throw kerror.getFrom(
        err,
        "services",
        "cache",
        "write_failed",
        err.message,
      );
    }
  }

  async verifyToken(token: string): Promise<Token> {
    if (token === null) {
      return this.anonymousToken;
    }

    const isApiKey = token.startsWith(Token.APIKEY_PREFIX);
    const tokenWithoutPrefix = this.removeTokenPrefix(token);

    let decoded = null;

    try {
      decoded = jwt.verify(tokenWithoutPrefix, global.kuzzle.secret);
      // probably forged token => throw without providing any information
      if (!decoded._id) {
        throw new jwt.JsonWebTokenError("Invalid token");
      }
    } catch (err) {
      if (err instanceof jwt.JsonWebTokenError) {
        throw securityError.get("invalid");
      }

      if (err instanceof jwt.TokenExpiredError) {
        throw securityError.get("expired");
      }

      throw securityError.getFrom(err, "verification_error", err.message);
    }

    if (isApiKey) {
      const fingerprint = sha256(token);

      const userApiKeys = await ApiKey.search({
        query: {
          term: {
            userId: decoded._id,
          },
        },
      });

      if (userApiKeys.length === 0) {
        throw securityError.get("invalid");
      }

      const targetApiKey = userApiKeys.find(
        (apiKey) => apiKey.fingerprint === fingerprint,
      );

      if (!targetApiKey) {
        throw securityError.get("invalid");
      }

      const apiKey = await ApiKey.load(decoded._id, targetApiKey._id);

      const userToken = new Token({
        _id: `${decoded._id}#${token}`,
        expiresAt: apiKey.expiresAt,
        jwt: token,
        ttl: apiKey.ttl,
        userId: decoded._id,
      });

      return userToken;
    }

    let userToken;

    try {
      userToken = await this.loadForUser(decoded._id, token);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        throw err;
      }
      throw securityError.getFrom(err, "verification_error", err.message);
    }

    if (userToken === null) {
      throw securityError.get("invalid");
    }

    if (userToken.singleUse) {
      await this.expire(userToken);
    }

    return userToken;
  }

  removeTokenPrefix(token: string) {
    return token
      .replace(Token.AUTH_PREFIX, "")
      .replace(Token.APIKEY_PREFIX, "");
  }

  loadForUser(userId: string, encodedToken: string): Promise<Token> {
    return this.load(`${userId}#${encodedToken}`);
  }

  async hydrate(userToken, data) {
    if (!_.isObject(data)) {
      return userToken;
    }

    _.assignIn(userToken, data);

    if (!userToken.userId) {
      return this.anonymousToken;
    }

    return userToken;
  }

  serializeToDatabase(token) {
    return this.serializeToCache(token);
  }

  /**
   * Deletes tokens affiliated to the provided user identifier
   */
  async deleteByKuid(kuid: string, { keepApiKeys = true } = {}) {
    const emptyKeyLength = super.getCacheKey("").length;
    const userKey = super.getCacheKey(`${kuid}#*`);

    const keys = await global.kuzzle.ask(
      "core:cache:internal:searchKeys",
      userKey,
    );

    /*
     Given the fact that user ids have no restriction, and that Redis pattern
     matching is lacking the kind of features we need to safeguard against
     matching unwanted keys, we need to prevent to accidentally remove tokens
     from other users.
     For instance, given these two users:
       foo
       foo#bar

     If we remove foo, "foo#bar"'s JWT will match the
     pattern "foo#*".

     This test is possible because '#' is not a valid
     JWT character
     */
    const ids = keys
      .map((key) => {
        return key.indexOf("#", userKey.length - 1) === -1
          ? key.slice(emptyKeyLength)
          : null;
      })
      .filter((key) => key !== null);

    const expireToken = async (token) => {
      const cacheToken = await this.load(token);

      if (cacheToken !== null) {
        if (keepApiKeys && cacheToken.type === "apiKey") {
          return;
        }

        await this.expire(cacheToken);
      }
    };

    const promises = [];

    for (const id of ids) {
      promises.push(expireToken(id));
    }

    await Promise.all(promises);
  }

  /**
   * The repository main class refreshes automatically the TTL
   * of accessed entries, letting only unaccessed entries expire
   *
   * But tokens' TTL must remain the same than their expiration time,
   * refreshing a token entry has no meaning.
   *
   * So we need to override the TTL auto-refresh function to disable it
   */
  async refreshCacheTTL() {
    // This comment is here to please Sonarqube. It requires a comment
    // explaining why a function is empty, but there is no sense
    // duplicating what has been just said in the JSDoc.
    // So, instead, here are the lyrics or Daft Punk's "Around the world":
    //
    // Around the world, around the world
    // Around the world, around the world
    // Around the world, around the world
    // Around the world, around the world
    // Around the world, around the world
    // [repeat 66 more times]
    // Around the world, around the world.
  }
}

/**
 * Returns a duration in milliseconds
 *  - returns 0 if the duration is invalid
 *  - -1 mean infinite
 */
function parseTimespan(time: string | number): number {
  if (typeof time === "string") {
    const milliseconds = ms(time);

    if (typeof milliseconds === "undefined") {
      return 0;
    }

    return milliseconds;
  }

  if (typeof time === "number") {
    return time;
  }

  return 0;
}
