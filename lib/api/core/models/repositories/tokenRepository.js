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
  _ = require('lodash'),
  jwt = require('jsonwebtoken'),
  ms = require('ms'),
  Bluebird = require('bluebird'),
  Token = require('../security/token'),
  Repository = require('./repository'),
  {
    InternalError: KuzzleInternalError,
    UnauthorizedError
  } = require('kuzzle-common-objects').errors;

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
  }

  init() {
    super.init({
      databaseEngine: null,
      // do not rely on the default value and explicitly
      // use Redis for this repository
      cacheEngine: this.kuzzle.services.list.internalCache
    });
  }

  /**
   * @param {Token} requestToken
   * @returns {Promise<Object>}
   */
  expire(requestToken) {
    return super.expireFromCache(requestToken)
      .then(() => this.kuzzle.tokenManager.expire(requestToken));
  }

  /**
   * @param {User} user
   * @param {Request} request
   * @param {object} opts
   * @returns {*}
   */
  generateToken(user, request, opts) {
    const options = opts || {};

    if (!user || user._id === null) {
      return Bluebird.reject(new KuzzleInternalError('Unknown User : cannot generate token'));
    }

    if (!request.context.connectionId) {
      return Bluebird.reject(new KuzzleInternalError('Unknown context : cannot generate token'));
    }

    if (!options.algorithm) {
      options.algorithm = this.kuzzle.config.security.jwt.algorithm;
    }

    if (!options.expiresIn) {
      options.expiresIn = this.kuzzle.config.security.jwt.expiresIn;
    }

    const expiresIn = parseTimespan(options.expiresIn);
    let encodedToken;

    try {
      encodedToken = jwt.sign({_id: user._id}, this.kuzzle.config.security.jwt.secret, options);
    }
    catch (err) {
      const error = new KuzzleInternalError('Error while generating token');
      error.details = err.message;
      error.stack = err.stack;
      return Bluebird.reject(error);
    }

    const token = new Token({
      _id: user._id + '#' + encodedToken,
      jwt: encodedToken,
      userId: user._id,
      ttl: expiresIn,
      expiresAt: Date.now() + expiresIn
    });

    return this.persistToCache(token, {ttl: expiresIn / 1000})
      .then(() => token)
      .catch(err => {
        const error = new KuzzleInternalError('Unable to generate token for unknown user');
        error.details = err.message;
        error.stack = err.stack;
        return Bluebird.reject(error);
      });
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
      let error;
      if (err instanceof jwt.TokenExpiredError) {
        error = new UnauthorizedError('Token expired');
        error.details = {
          subCode: error.subCodes.TokenExpired,
          expiredAt: err.expiredAt
        };
      }
      else if (err instanceof jwt.JsonWebTokenError) {
        error = new UnauthorizedError('Json Web Token Error');
        error.details = {
          subCode: error.subCodes.JsonWebTokenError,
          description: err.message
        };
      }
      else {
        error = new KuzzleInternalError('Error verifying token');
        error.details = err;
      }

      return Bluebird.reject(error);
    }

    return this.load(decoded._id + '#' + token)
      .then(userToken => {
        if (userToken === null) {
          throw new UnauthorizedError('Invalid token', 401);
        }

        return userToken;
      })
      .catch(err => {
        if (err instanceof UnauthorizedError) {
          throw err;
        }

        const error = new KuzzleInternalError('Unexpected error while verifying a token');
        error.details = err;

        throw error;
      });
  }

  hydrate (userToken, data) {
    if (!_.isObject(data)) {
      return Bluebird.resolve(userToken);
    }

    _.assignIn(userToken, data);

    if (!userToken.userId || userToken.userId === undefined || userToken.userId === null) {
      return Bluebird.resolve(this.anonymous());
    }

    return Bluebird.resolve(userToken);
  }

  anonymous () {
    return new Token({userId: '-1'});
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
  deleteByUserId(userId) {
    const
      emptyKeyLength = super.getCacheKey('').length,
      userKey = super.getCacheKey(userId + '#*');

    return this.cacheEngine.searchKeys(userKey)
      .then(keys => {
        /*
         Given the fact that user ids have no restriction,
         and that Redis pattern matching is lacking the
         kind of features we need to safeguard against
         matching unwanted keys,
         we need to prevent to accidentally remove tokens
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
          .map(key => key.indexOf('#', userKey.length - 1) === -1 ? key.slice(emptyKeyLength) : null)
          .filter(key => key !== null);

        return Bluebird.map(ids, token => this.load(token).then(cacheToken => {
          if (cacheToken !== null) {
            return this.expire(cacheToken);
          }

          return null;
        }));
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

function parseTimespan(time) {
  if (typeof time === 'string') {
    const milliseconds = ms(time);

    if (typeof milliseconds === 'undefined') {
      return -1;
    }

    return milliseconds;
  }

  if (typeof time === 'number') {
    return time;
  }

  return -1;
}
