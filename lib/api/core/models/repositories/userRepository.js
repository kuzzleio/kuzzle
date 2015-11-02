module.exports = function (kuzzle) {
  var
    _ = require('lodash'),
    jwt = require('jsonwebtoken'),
    q = require('q'),
    uuid = require('node-uuid'),
    User = require('../security/user'),
    Repository = require('./repository'),
    RequestObject = require('../requestObject');

  function UserRepository () {
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

      this.loadFromCache(decodedToken._id)
        .then(function (user) {
          if (user === null) {
            this.loadOneFromDatabase(decodedToken._id)
              .then(function (userFromDatabase) {
                if (userFromDatabase === null) {
                  deferred.resolve(this.anonymous());
                }
                else {
                  deferred.resolve(userFromDatabase);
                }
              }.bind(this))
              .catch(function (error) {
                deferred.reject(error);
              });
          }
          else {
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

    this.persistInDB(user);

    return this.persistInCache(user, {
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

  UserRepository.prototype.hydrate = function (user, data) {
    var
      deferred = q.defer();

    if (!_.isObject(data) || !data.profile || data._id === undefined) {
      return this.anonymous();
    }

    kuzzle.repositories.profile.loadProfile(data.profile)
      .then(function (profile) {
        user.profile = profile;

        Object.keys(data).forEach(function (key) {
          if (key !== 'profile') {
            user[key] = data[key];
          }
        });

        deferred.resolve(user);
      })
      .catch(function (error) {
        deferred.reject(error);
      });

    return deferred.promise;
  };

  UserRepository.prototype.serializeToCache = function (user) {
    var result = _.toPlainObject(user);

    result.profile = user.profile.name;

    return result;
  };

  UserRepository.prototype.serializeToDB = UserRepository.prototype.serializeToCache;

  return UserRepository;

};

