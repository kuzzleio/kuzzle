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
const jwt = require('jsonwebtoken');
const ms = require('ms');
const Bluebird = require('bluebird');
const Token = require('../../models/security/token');
const Repository = require('../shared/repository');
const errorsManager = require('../../util/errors');
const { errors: { UnauthorizedError } } = require('kuzzle-common-objects');

const securityError = errorsManager.wrap('security', 'token');

/**
 * @class TokenRepository
 * @extends Repository
 * @param {Kuzzle} kuzzle
 * @param {object} [opts]
 */
class TokenRepository extends Repository {
  constructor (kuzzle, opts = {}) {
    super(kuzzle);
    this.kuzzle = kuzzle;
    this.collection = 'token';
    this.ObjectConstructor = Token;
    if (opts.ttl !== undefined) {
      this.ttl = opts.ttl;
    }

    this.tokenGracePeriod = this.kuzzle.config.security.jwt.gracePeriod / 1000;
  }

  async init() {
    super.init({
      cacheEngine: this.kuzzle.cacheEngine.internal,
      // do not rely on the default value and explicitly
      // use Redis for this repository
      indexStorage: null
    });

    this.kuzzle.onAsk(
      'core:security:tokens:create',
      (userId, opts) => this.generateToken(userId, opts));
    this.kuzzle.onAsk('core:security:tokens:delete', token => this.expire(token));
    this.kuzzle.onAsk(
      'core:security:tokens:deleteByUser',
      userId => this.deleteByUserId(userId));
    this.kuzzle.onAsk(
      'core:security:tokens:get',
      (userId, token) => this.loadForUser(userId, token));
    this.kuzzle.onAsk(
      'core:security:tokens:refresh',
      (token, expiresIn) => this.refresh(token, expiresIn));
    this.kuzzle.onAsk(
      'core:security:tokens:restore',
      (token, userId, ttl) => this.persistForUser(token, userId, ttl));
    this.kuzzle.onAsk(
      'core:security:tokens:verify',
      token => this.verifyToken(token));
  }

  /**
   * Expires the given token immediately
   * @param {Token} requestToken
   * @returns {Promise}
   */
  async expire (token) {
    await super.expireFromCache(token);
    this.kuzzle.tokenManager.expire(token);
  }

  /**
   * We allow a grace period before expiring the token to allow
   * queued requests to execute, but we mark the token as "refreshed" to forbid
   * any refreshes on that token, to prevent token bombing
   *
   * @param {Token} requestToken
   * @param {String} expiresIn - new token expiration delay
   * @returns {Promise<Token>}
   */
  async refresh (token, expiresIn) {
    // do not refresh a token marked as already refreshed
    if (token.refreshed) {
      throw securityError.get('invalid');
    }

    const refreshed = await this.generateToken(token.userId, {expiresIn});

    // Mark as "refreshed" only if generating the new token succeeds
    token.refreshed = true;
    await this.persistToCache(token, {ttl: this.tokenGracePeriod});

    this.kuzzle.tokenManager.refresh(token, refreshed);

    return refreshed;
  }

  /**
   * @param {User} user
   * @param {Object} options - { algorithm, expiresIn, bypassMaxTTL (false) }
   *
   * @returns {Object} { _id, jwt, userId, ttl, expiresAt }
   */
  generateToken (
    user,
    {
      algorithm = this.kuzzle.config.security.jwt.algorithm,
      expiresIn = this.kuzzle.config.security.jwt.expiresIn,
      bypassMaxTTL = false
    } = {}
  ) {
    if (!user || user._id === null) {
      return securityError.reject('unknown_user');
    }

    const parsedExpiresIn = parseTimespan(expiresIn);

    if ( ! bypassMaxTTL
      && this.kuzzle.config.security.jwt.maxTTL > 0
      && ( parsedExpiresIn > this.kuzzle.config.security.jwt.maxTTL
        || parsedExpiresIn === -1)
    ) {
      return securityError.reject('ttl_exceeded');
    }

    const signOptions = {algorithm};

    // error parsing expiresIn, let jwt.sign handle the incorrect value
    if (parsedExpiresIn === 0) {
      signOptions.expiresIn = expiresIn;
    }
    else if (parsedExpiresIn !== -1) {
      // -1 mean infite duration, so we don't pass the expiresIn option to jwt.sign
      signOptions.expiresIn = parsedExpiresIn;
    }

    let encodedToken;

    try {
      encodedToken = jwt.sign(
        { _id: user._id },
        this.kuzzle.config.security.jwt.secret,
        signOptions);
    }
    catch (err) {
      return securityError.rejectFrom(err, 'generation_failed', err.message);
    }

    return this.persistForUser(encodedToken, user._id, parsedExpiresIn);
  }

  /**
   * Persists a token in Redis cache
   *
   * @param {String} encodedToken - Encoded token
   * @param {String} userId - User ID
   * @param {Number} ttl - TTL in ms (-1 for infinite duration)
   *
   * @returns {Promise}
   */
  async persistForUser (encodedToken, userId, ttl) {
    const redisTTL = ttl !== -1 ? ttl / 1000 : false;
    const expiresAt = ttl !== -1 ? Date.now() + ttl : -1;
    const token = new Token({
      _id: `${userId}#${encodedToken}`,
      expiresAt,
      jwt: encodedToken,
      ttl,
      userId
    });

    try {
      return await this.persistToCache(token, { ttl: redisTTL });
    }
    catch(err) {
      throw errorsManager.getFrom(
        err,
        'services',
        'cache',
        'write_failed',
        err.message);
    }
  }

  verifyToken(token) {
    if (token === null) {
      return Bluebird.resolve(this.anonymous());
    }

    let decoded = null;

    try {
      decoded = jwt.verify(token, this.kuzzle.config.security.jwt.secret);

      // probably forged token => throw without providing any information
      if (!decoded._id) {
        throw new jwt.JsonWebTokenError('Invalid token');
      }
    }
    catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return securityError.reject('expired');
      }

      if (err instanceof jwt.JsonWebTokenError) {
        return securityError.reject('invalid');
      }

      return securityError.rejectFrom(err, 'verification_error', err.message);
    }

    return this.loadForUser(decoded._id, token)
      .then(userToken => {
        if (userToken === null) {
          throw securityError.get('invalid');
        }

        return userToken;
      })
      .catch(err => {
        if (err instanceof UnauthorizedError) {
          throw err;
        }

        throw securityError.getFrom(err, 'verification_error', err.message);
      });
  }

  loadForUser (userId, encodedToken) {
    return this.load(`${userId}#${encodedToken}`);
  }

  hydrate (userToken, data) {
    if (!_.isObject(data)) {
      return Bluebird.resolve(userToken);
    }

    _.assignIn(userToken, data);

    if (!userToken.userId) {
      return Bluebird.resolve(this.anonymous());
    }

    return Bluebird.resolve(userToken);
  }

  serializeToDatabase (token) {
    return this.serializeToCache(token);
  }

  /**
   * Deletes tokens affiliated to the provided user identifier
   *
   * @param {string} userId
   * @return {Promise}
   */
  async deleteByUserId(userId) {
    const emptyKeyLength = super.getCacheKey('').length;
    const userKey = super.getCacheKey(`${userId}#*`);

    const keys = await this.cacheEngine.searchKeys(userKey);
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
      .map(key => key.indexOf('#', userKey.length - 1) === -1
        ? key.slice(emptyKeyLength)
        : null)
      .filter(key => key !== null);

    return Bluebird.map(ids, async token => {
      const cacheToken = await this.load(token);

      if (cacheToken !== null) {
        return this.expire(cacheToken);
      }

      return null;
    });
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
  refreshCacheTTL() {
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

module.exports = TokenRepository;

/**
 * Returns a duration in milliseconds
 *  - returns 0 if the duration is invalid
 *  - -1 mean infinite
 *
 * @param {String|Number} time
 */
function parseTimespan (time) {
  if (typeof time === 'string') {
    const milliseconds = ms(time);

    if (typeof milliseconds === 'undefined') {
      return 0;
    }

    return milliseconds;
  }

  if (typeof time === 'number') {
    return time;
  }

  return 0;
}
