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

const ApiKey = require('../../model/storage/apiKey');
const { UnauthorizedError } = require('../../kerror/errors');
const Token = require('../../model/security/token');
const Repository = require('../shared/repository');
const kerror = require('../../kerror');
const debug = require('../../util/debug')('kuzzle:bootstrap:tokens');
const { Mutex } = require('../../util/mutex');

const securityError = kerror.wrap('security', 'token');

const BOOTSTRAP_DONE_KEY = 'token/bootstrap';

/**
 * @class TokenRepository
 * @extends Repository
 * @param {Kuzzle} kuzzle
 * @param {object} [opts]
 */
class TokenRepository extends Repository {
  constructor (opts = {}) {
    super();
    this.collection = 'token';
    this.ObjectConstructor = Token;
    if (opts.ttl !== undefined) {
      this.ttl = opts.ttl;
    }

    this.tokenGracePeriod = Math.floor(global.kuzzle.config.security.jwt.gracePeriod);
    this.anonymousToken = new Token({userId: '-1'});
  }

  async init() {
    await this._loadApiKeys();

    /**
     * Assign an existing token to a user. Stores the token in Kuzzle's cache.
     * @param  {String} hash - JWT
     * @param  {String} userId
     * @param  {Number} ttl - token expiration delay
     * @returns {Token}
     */
    global.kuzzle.onAsk(
      'core:security:token:assign',
      (hash, userId, ttl) => this.persistForUser(hash, userId, ttl));

    /**
     * Creates and assigns a token to a user
     * @param  {User} user
     * @param  {Objects} opts (algorithm, expiresIn, bypassMaxTTL)
     * @returns {Token}
     */
    global.kuzzle.onAsk(
      'core:security:token:create',
      (user, opts) => this.generateToken(user, opts));

    /**
     * Deletes a token immediately
     * @param  {Token} token
     */
    global.kuzzle.onAsk('core:security:token:delete', token => this.expire(token));

    /**
     * Deletes all tokens assigned to the provided user ID.
     * @param  {String} userId
     */
    global.kuzzle.onAsk(
      'core:security:token:deleteByKuid',
      kuid => this.deleteByKuid(kuid));

    /**
     * Gets a token
     * @param  {String} userId - user identifier
     * @param  {String} hash - JWT
     * @returns {Token}
     */
    global.kuzzle.onAsk(
      'core:security:token:get',
      (userId, hash) => this.loadForUser(userId, hash));

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
      'core:security:token:refresh',
      (user, token, expiresIn) => this.refresh(user, token, expiresIn));

    /**
     * Verifies if the provided hash is valid, and returns the corresponding
     * Token object
     * @param  {String} hash - JWT
     * @returns {Token}
     */
    global.kuzzle.onAsk(
      'core:security:token:verify',
      hash => this.verifyToken(hash));
  }

  /**
   * Expires the given token immediately
   * @param {Token} requestToken
   * @returns {Promise}
   */
  async expire (token) {
    await super.expireFromCache(token);
    await global.kuzzle.tokenManager.expire(token);
  }

  /**
   * We allow a grace period before expiring the token to allow
   * queued requests to execute, but we mark the token as "refreshed" to forbid
   * any refreshes on that token, to prevent token bombing
   *
   * @param {User} user
   * @param {Token} requestToken
   * @param {String} expiresIn - new token expiration delay
   * @returns {Promise<Token>}
   */
  async refresh (user, token, expiresIn) {
    // do not refresh a token marked as already refreshed
    if (token.refreshed) {
      throw securityError.get('invalid');
    }

    const refreshed = await this.generateToken(user, {expiresIn});

    // Mark as "refreshed" only if generating the new token succeeds
    token.refreshed = true;
    await this.persistToCache(token, {ttl: this.tokenGracePeriod});

    global.kuzzle.tokenManager.refresh(token, refreshed);

    return refreshed;
  }

  /**
   * @param {User} user
   * @param {Object} options - { algorithm, expiresIn, bypassMaxTTL (false) }
   *
   * @returns {Promise.<Object>} { _id, jwt, userId, ttl, expiresAt }
   */
  async generateToken (
    user,
    {
      algorithm = global.kuzzle.config.security.jwt.algorithm,
      expiresIn = global.kuzzle.config.security.jwt.expiresIn,
      bypassMaxTTL = false
    } = {}
  ) {
    if (!user || user._id === null) {
      throw securityError.get('unknown_user');
    }

    const parsedExpiresIn = parseTimespan(expiresIn);

    if ( ! bypassMaxTTL
      && global.kuzzle.config.security.jwt.maxTTL > 0
      && ( parsedExpiresIn > global.kuzzle.config.security.jwt.maxTTL
        || parsedExpiresIn === -1)
    ) {
      throw securityError.get('ttl_exceeded');
    }

    const signOptions = {algorithm};

    if (parsedExpiresIn === 0) {
      throw kerror.get('api', 'assert', 'invalid_argument', 'expiresIn', 'a number of milliseconds, or a parsable timespan string');
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
        signOptions);
    }
    catch (err) {
      throw securityError.getFrom(err, 'generation_failed', err.message);
    }

    return this.persistForUser(encodedToken, user._id, parsedExpiresIn);
  }

  /**
   * Persists a token in the cache
   *
   * @param {String} encodedToken - Encoded token
   * @param {String} userId - User ID
   * @param {Number} ttl - TTL in ms (-1 for infinite duration)
   *
   * @returns {Promise}
   */
  async persistForUser (encodedToken, userId, ttl) {
    const redisTTL = ttl !== -1 ? ttl : 0;
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
      throw kerror.getFrom(
        err,
        'services',
        'cache',
        'write_failed',
        err.message);
    }
  }

  async verifyToken(token) {
    if (token === null) {
      return this.anonymousToken;
    }

    let decoded = null;

    try {
      decoded = jwt.verify(token, global.kuzzle.secret);

      // probably forged token => throw without providing any information
      if (!decoded._id) {
        throw new jwt.JsonWebTokenError('Invalid token');
      }
    }
    catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw securityError.get('expired');
      }

      if (err instanceof jwt.JsonWebTokenError) {
        throw securityError.get('invalid');
      }

      throw securityError.getFrom(err, 'verification_error', err.message);
    }

    let userToken;

    try {
      userToken = await this.loadForUser(decoded._id, token);
    }
    catch(err) {
      if (err instanceof UnauthorizedError) {
        throw err;
      }

      throw securityError.getFrom(err, 'verification_error', err.message);
    }

    if (userToken === null) {
      throw securityError.get('invalid');
    }

    return userToken;
  }

  loadForUser (userId, encodedToken) {
    return this.load(`${userId}#${encodedToken}`);
  }

  async hydrate (userToken, data) {
    if (!_.isObject(data)) {
      return userToken;
    }

    _.assignIn(userToken, data);

    if (!userToken.userId) {
      return this.anonymousToken;
    }

    return userToken;
  }

  serializeToDatabase (token) {
    return this.serializeToCache(token);
  }

  /**
   * Deletes tokens affiliated to the provided user identifier
   *
   * @param {string} kuid
   * @returns {Promise}
   */
  async deleteByKuid (kuid) {
    const emptyKeyLength = super.getCacheKey('').length;
    const userKey = super.getCacheKey(`${kuid}#*`);

    const keys = await global.kuzzle.ask('core:cache:internal:searchKeys', userKey);

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
      .map(key => {
        return key.indexOf('#', userKey.length - 1) === -1
          ? key.slice(emptyKeyLength)
          : null;
      })
      .filter(key => key !== null);

    await Bluebird.map(ids, async token => {
      const cacheToken = await this.load(token);

      if (cacheToken !== null) {
        await this.expire(cacheToken);
      }
    });
  }

  /**
   * Loads authentication token from API key into Redis
   *
   * @returns {Promise}
   */
  async _loadApiKeys () {
    const mutex = new Mutex('ApiKeysBootstrap', {
      timeout: -1,
      ttl: 30000,
    });

    await mutex.lock();

    try {
      const bootstrapped = await global.kuzzle.ask(
        'core:cache:internal:get',
        BOOTSTRAP_DONE_KEY);

      if (bootstrapped) {
        debug('API keys already in cache. Skip.');
        return;
      }

      debug('Loading API keys into Redis');

      const promises = [];
      const createToken = async ({token, ttl, userId }) => {
        return await this.persistForUser(token, userId, ttl);
      };

      await ApiKey.batchExecute({ match_all: {} }, apiKeys => {
        for (const { _source } of apiKeys) {
          promises.push(createToken(_source));
        }
      });

      await Bluebird.all(promises);

      await global.kuzzle.ask('core:cache:internal:store', BOOTSTRAP_DONE_KEY, 1);
    }
    finally {
      mutex.unlock();
    }
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
 * @return {Number}
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
