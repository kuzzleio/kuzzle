module.exports = function (kuzzle) {
  var
    _ = require('lodash'),
    q = require('q'),
    uuid = require('node-uuid'),
    User = require('../security/user'),
    Repository = require('./repository');


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

