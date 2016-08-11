var
  _ = require('lodash'),
  jwt = require('jsonwebtoken'),
  ms = require('ms'),
  Promise = require('bluebird'),
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

/**
 * @class TokenRepository
 * @extends Repository
 * @param {Kuzzle} kuzzle
 * @param opts
 * @constructor
 */
function TokenRepository (kuzzle, opts) {
  Repository.apply(this, arguments);
  this.collection = 'token';
  this.ObjectConstructor = Token;
  if (opts !== undefined && opts.ttl !== undefined) {
    this.ttl = opts.ttl;
  }
}

TokenRepository.prototype = Object.create(Repository.prototype);
TokenRepository.prototype.constructor = TokenRepository;

TokenRepository.prototype.init = function() {
  Repository.prototype.init.call(this, {
    cacheEngine: this.kuzzle.services.list.tokenCache,
    databaseEngine: null
  });
};

TokenRepository.prototype.expire = function(token) {
  var
    error;

  return Repository.prototype.expireFromCache.call(this, token)
    .then(() => this.kuzzle.tokenManager.expire(token))
    .catch(err => {
      error = new InternalError('Error expiring token');
      error.details = err;

      return Promise.reject(error);
    });
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
    return Promise.reject(error);
  }

  if (!context || context.connection === null) {
    error = new InternalError('Unknown context connection : cannot generate token');
    return Promise.reject(error);
  }

  if (!options.algorithm) {
    options.algorithm = this.kuzzle.config.jsonWebToken.algorithm;
  }
  if (!options.expiresIn) {
    options.expiresIn = this.kuzzle.config.jsonWebToken.expiresIn;
  }

  try {
    expiresIn = parseTimespan(options.expiresIn);
    encodedToken = jwt.sign({_id: user._id}, this.kuzzle.config.jsonWebToken.secret, options);

    _.assignIn(token, {
      _id: encodedToken,
      userId: user._id,
      ttl: expiresIn,
      expiresAt: Date.now() + expiresIn
    });

    return this.persistToCache(token)
      .then(() => {
        this.kuzzle.tokenManager.add(token, context);

        return token;
      })
      .catch(err => {
        error = new InternalError('Unable to generate token for unknown user');
        error.details = err.message;
        error.stack = err.stack;
        return Promise.reject(error);
      });
  }
  catch (err) {
    error = new InternalError('Error while generating token');
    error.details = err.message;
    error.stack = err.stack;
    return Promise.reject(error);
  }
};

TokenRepository.prototype.verifyToken = function (token) {
  var
    error;

  if (token === null) {
    return this.anonymous();
  }

  try {
    jwt.verify(token, this.kuzzle.config.jsonWebToken.secret);
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

    return Promise.reject(error);
  }

  return this.load(token)
    .then(userToken => {
      if (userToken === null) {
        return Promise.reject(new UnauthorizedError('Invalid token', 401));
      }

      return userToken;
    })
    .catch(err => {
      if (err instanceof UnauthorizedError) {
        return Promise.reject(err);
      }

      error = new InternalError('Unknown user');
      error.details = err;

      return Promise.reject(error);
    });
};

TokenRepository.prototype.hydrate = function (userToken, data) {
  if (!_.isObject(data)) {
    return Promise.resolve(userToken);
  }

  _.assignIn(userToken, data);

  if (!userToken.userId || userToken.userId === undefined || userToken.userId === null) {
    return this.anonymous();
  }

  return Promise.resolve(userToken);
};

TokenRepository.prototype.anonymous = function () {
  var
    token = new Token();

  token._id = undefined;
  token.userId = -1;

  return Promise.resolve(token);
};

TokenRepository.prototype.serializeToDatabase = TokenRepository.prototype.serializeToCache;

module.exports = TokenRepository;
