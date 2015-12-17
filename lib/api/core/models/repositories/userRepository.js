module.exports = function (kuzzle) {
  var
    _ = require('lodash'),
    jwt = require('jsonwebtoken'),
    q = require('q'),
    uuid = require('node-uuid'),
    User = require('../security/user'),
    Repository = require('./repository'),
    InternalError = require('../../errors/internalError'),
    UnauthorizedError = require('../../errors/unauthorizedError');


  function UserRepository (opts) {
    var options = opts || {};

    if (options.ttl !== undefined) {
      this.ttl = options.ttl;
    }
  }

  UserRepository.prototype = new Repository(kuzzle, {
    index: '%kuzzle',
    collection: 'users',
    ObjectConstructor: User,
    cacheEngine: kuzzle.services.list.userCache
  });

  UserRepository.prototype.loadFromToken = function (userToken) {
    var
      deferred = q.defer(),
      decodedToken,
      error;

    if (userToken === null) {
      return this.anonymous();
    }

    try {
      decodedToken = jwt.verify(userToken, kuzzle.config.jsonWebToken.secret);

      if (decodedToken._id === 'admin') {
        return this.admin();
      }

      this.load(decodedToken._id)
        .then(function (user) {
          if (user === null) {
            deferred.resolve(this.anonymous());
          }
          else {
            deferred.resolve(user);
          }
        }.bind(this))
        .catch(function (err) {
          deferred.reject(err);
        });
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
        error = new InternalError('Error loading User');
        error.details = err;
      }

      deferred.reject(error);
    }

    return deferred.promise;
  };


  UserRepository.prototype.persist = function (user) {
    if (user._id === undefined || user._id === null) {
      user._id = uuid.v4();
    }

    this.persistToDatabase(user);

    return this.persistToCache(user);
  };

  UserRepository.prototype.anonymous = function () {
    var
      user = new User();

    return this.hydrate(user, {
      _id: -1,
      name: 'Anonymous',
      profile: 'anonymous'
    });
  };

  UserRepository.prototype.admin = function () {
    var user = new User();

    return this.hydrate(user, {
      _id: 'admin',
      name: 'Administrator',
      profile: 'admin'
    });
  };

  UserRepository.prototype.hydrate = function (user, data) {
    var
      deferred = q.defer(),
      result;

    if (!_.isObject(data)) {
      return Promise.resolve(user);
    }

    Repository.prototype.hydrate(user, data)
      .then(u => {
        result = u;

        if (!u.profile || u._id === undefined || u._id === null) {
          return this.anonymous()
            .then(anonymousUser => {
              result = anonymousUser;
              return Promise.resolve(anonymousUser.profile);
            });
        }

        return kuzzle.repositories.profile.loadProfile(u.profile);
      })
      .then(function (profile) {
        result.profile = profile;
        deferred.resolve(result);
      })
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
  };

  UserRepository.prototype.serializeToCache = function (user) {
    var result = {};

    Object.keys(user).forEach(function (key) {
      if (key !== 'profile') {
        result[key] = user[key];
      }
    });
    result.profile = user.profile._id;

    return result;
  };

  UserRepository.prototype.serializeToDatabase = UserRepository.prototype.serializeToCache;

  return UserRepository;

};

