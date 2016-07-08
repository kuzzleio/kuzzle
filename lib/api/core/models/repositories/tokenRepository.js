module.exports = function (kuzzle) {
  var
    _ = require('lodash'),
    jwt = require('jsonwebtoken'),
    ms = require('ms'),
    q = require('q'),
    Token = require('../security/token'),
    Repository = require('./repository'),
    InternalError = require('kuzzle-common-objects').Errors.internalError,
    UnauthorizedError = require('kuzzle-common-objects').Errors.unauthorizedError;

  function parseTimespan(time) {
    var milliseconds;

    if (typeof time === 'string') {
      milliseconds = ms(time);

      if (typeof milliseconds === 'undefined') {
        return -1;
      }

      return milliseconds;
    }
    else if (typeof time === 'number') {
      return time;
    }

    return -1;
  }

  function TokenRepository (opts) {
    var options = opts || {};

    if (options.ttl !== undefined) {
      this.ttl = options.ttl;
    }
  }

  TokenRepository.prototype = new Repository(kuzzle, {
    index: kuzzle.config.internalIndex,
    collection: 'token',
    ObjectConstructor: Token,
    cacheEngine: kuzzle.services.list.tokenCache,
    readEngine: null
  });

  TokenRepository.prototype.expire = function(token) {
    var
      error,
      deferred = q.defer();

    Repository.prototype.expireFromCache.call(this, token)
      .then(() => {
        kuzzle.tokenManager.expire(token);

        deferred.resolve();
      })
      .catch(err => {
        error = new InternalError('Error expiring token');
        error.details = err;

        deferred.reject(error);
      });

    return deferred.promise;
  };

  TokenRepository.prototype.generateToken = function (user, context, opts) {
    var
      expiresIn,
      token = new Token(),
      options = opts || {},
      encodedToken,
      error;

    if (!user || user._id === null) {
      error = new InternalError('Unknown User : cannot generate token');
      return q.reject(error);
    }

    if (!context || context.connection === null) {
      error = new InternalError('Unknown context connection : cannot generate token');
      return q.reject(error);
    }

    if (!options.algorithm) {
      options.algorithm = kuzzle.config.jsonWebToken.algorithm;
    }
    if (!options.expiresIn) {
      options.expiresIn = kuzzle.config.jsonWebToken.expiresIn;
    }

    try {
      expiresIn = parseTimespan(options.expiresIn);
      encodedToken = jwt.sign({_id: user._id}, kuzzle.config.jsonWebToken.secret, options);

      _.assignIn(token, {
        _id: encodedToken,
        userId: user._id,
        ttl: expiresIn,
        expiresAt: Date.now() + expiresIn
      });

      return this.persistToCache(token)
        .then(() => {
          kuzzle.tokenManager.add(token, context);

          return token;
        })
        .catch(err => {
          error = new InternalError('Unable to generate token for unknown user');
          error.details = err.message;
          error.stack = err.stack;
          return q.reject(error);
        });
    }
    catch (err) {
      error = new InternalError('Error while generating token');
      error.details = err.message;
      error.stack = err.stack;
      return q.reject(error);
    }
  };

  TokenRepository.prototype.verifyToken = function (token) {
    var
      error,
      deferred;

    if (token === null) {
      return this.anonymous();
    }

    try {
      jwt.verify(token, kuzzle.config.jsonWebToken.secret);
    }
    catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        error = new UnauthorizedError('Token expired', 401);
        error.details = {
          subCode: error.subCodes.TokenExpired,
          expiredAt: err.expiredAt
        };
      }
      else if (err instanceof jwt.JsonWebTokenError) {
        error = new UnauthorizedError('Json Web Token Error', 401);
        error.details = {
          subCode: error.subCodes.JsonWebTokenError,
          description: err.message
        };
      }
      else {
        error = new InternalError('Error verifying token');
        error.details = err;
      }

      return q.reject(error);
    }

    deferred = q.defer();

    this.load(token)
      .then(userToken => {
        if (userToken === null) {
          return deferred.reject(new UnauthorizedError('Invalid token', 401));
        }

        return deferred.resolve(userToken);
      })
      .catch(err => {
        error = new InternalError('Unknown user');
        error.details = err;

        return deferred.reject(error);
      });

    return deferred.promise;
  };

  TokenRepository.prototype.hydrate = function (userToken, data) {
    if (!_.isObject(data)) {
      return q(userToken);
    }

    _.assignIn(userToken, data);

    if (!userToken.userId || userToken.userId === undefined || userToken.userId === null) {
      return this.anonymous();
    }

    return q(userToken);
  };

  TokenRepository.prototype.anonymous = function () {
    var
      token = new Token();

    token._id = undefined;
    token.userId = -1;

    return q(token);
  };

  TokenRepository.prototype.serializeToDatabase = TokenRepository.prototype.serializeToCache;

  return TokenRepository;
};

