module.exports = function (kuzzle) {
  var
    _ = require('lodash'),
    jwt = require('jsonwebtoken'),
    q = require('q'),
    uuid = require('node-uuid'),
    User = require('../security/user'),
    Repository = require('./repository');


  function UserRepository (opts) {
    var options = opts || {};

    if (options.ttl) {
      this.ttl = options.ttl;
    }
  }

  UserRepository.prototype = new Repository(kuzzle, {
    collection: '_kuzzle/users',
    ObjectConstructor: User,
    cacheEngine: kuzzle.services.list.userCache
  });

  UserRepository.prototype.loadFromToken = function (userToken) {
    var
      deferred = q.defer(),
      decodedToken;

    if (userToken === null) {
      return this.anonymous();
    }

    try {
      decodedToken = jwt.verify(userToken, kuzzle.config.jsonWebToken.secret);

      if (decodedToken._id === 'admin') {
        return this.admin();
      }

      this.loadFromCache(decodedToken._id)
        .then(function (user) {
          if (user === null) {
            this.loadOneFromDatabase(decodedToken._id)
              .then(function (userFromDatabase) {
                if (userFromDatabase === null) {
                  deferred.resolve(this.anonymous());
                }
                else {
                  this.persistToCache(userFromDatabase);

                  deferred.resolve(userFromDatabase);
                }
              }.bind(this))
              .catch(function (error) {
                deferred.reject(error);
              });
          }
          else {
            this.refreshCacheTTL(user);

            deferred.resolve(user);
          }
        }.bind(this))
        .catch(function (error) {
          deferred.reject(error);
        });
    }
    catch (error) {
      deferred.reject(error);
    }

    return deferred.promise;
  };


  UserRepository.prototype.persist = function (user) {
    if (user._id === undefined) {
      user._id = uuid.v1();
    }

    this.persistToDB(user);

    return this.persistToCache(user, {
      ttl: this.ttl
    });
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
      return this.anonymous();
    }

    Repository.prototype.hydrate(user, data)
      .then(function (u) {
        result = u;

        if (!u.profile || u._id === undefined) {
          return this.anonymous();
        }

        return kuzzle.repositories.profile.loadProfile(u.profile);
      }.bind(this))
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

  UserRepository.prototype.serializeToDB = UserRepository.prototype.serializeToCache;

  return UserRepository;

};

