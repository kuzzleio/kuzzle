module.exports = function (kuzzle) {
  var
    _ = require('lodash'),
    jwt = require('jsonwebtoken'),
    q = require('q'),
    uuid = require('node-uuid'),
    User = require('../security/user'),
    Repository = require('./repository'),
    PasswordManager = require('../../auth/passwordManager'),
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

  UserRepository.prototype.generateToken = function (username, opts) {
    var
      deferred = q.defer(),
      options = opts || {},
      encodedToken,
      error;

    if (username === null) {
      error = new InternalError('Unknown User : cannot generate token');
      deferred.reject(error);
      return deferred.promise;
    }

    if (!options.algorithm) {
      options.algorithm = kuzzle.config.jsonWebToken.algorithm;
    }
    if (!options.expiresIn) {
      options.expiresIn = kuzzle.config.jsonWebToken.expiresIn;
    }

    try {
      encodedToken = jwt.sign({_id: username}, kuzzle.config.jsonWebToken.secret, options);
      deferred.resolve(encodedToken);
    }
    catch (err) {
      error = new InternalError('Error loading User');
      error.details = err;
      deferred.reject(error);
    }

    return deferred.promise;
  };

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

  UserRepository.prototype.loadByUsernameAndPassword = function (username, password) {
    var
      deferred = q.defer(),
      passwordManager = new PasswordManager(kuzzle.config.passwordManager);

    this.load(username)
      .then(function (user) {
        if (user === null) {
          deferred.resolve(null);
        }
        else {
          passwordManager.checkPassword(password, user.password)
            .then(function(result) {
              if (result === false) {
                user = null;
              }
              deferred.resolve(user);
            });
        }
      })
      .catch(function (err) {
        deferred.reject(err);
      });
    return deferred.promise;
  };

  UserRepository.prototype.load = function (id) {
    if (id === 'anonymous' || id === -1) {
      return this.anonymous();
    }

    if (id === 'admin') {
      return this.admin();
    }

    return Repository.prototype.load.call(this, id);
  };

  UserRepository.prototype.persist = function (user, opts) {
    var
      deferred = q.defer(),
      options = opts || {},
      databaseOptions = options.database || {},
      cacheOptions = options.cache || {},
      response;

    if (user._id === undefined || user._id === null) {
      user._id = uuid.v4();
    }

    this.persistToDatabase(user, databaseOptions)
      .then(r => {
        response = r;
        return this.persistToCache(user, cacheOptions);
      })
      .then(() => {
        deferred.resolve(response);
      })
      .catch(error => { deferred.reject(error); });

    return deferred.promise;
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
    var result;

    if (!_.isObject(data)) {
      return q(user);
    }

    return Repository.prototype.hydrate(user, data)
      .then(u => {
        result = u;

        if (!u.profile || u._id === undefined || u._id === null) {
          return this.anonymous()
            .then(anonymousUser => {
              result = anonymousUser;
              return anonymousUser.profile;
            });
        }

        return kuzzle.repositories.profile.loadProfile(u.profile);
      })
      .then(function (profile) {
        if (!profile) {
          return deferred.reject(new InternalError('Could not find profile:' + user.profile));
        }

        result.profile = profile;
        return result;
      });
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

  UserRepository.prototype.serializeToDatabase = function (user) {
    var result = this.serializeToCache(user);

    delete result._id;

    return result;
  };

  return UserRepository;

};

