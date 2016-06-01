module.exports = function (kuzzle) {
  var
    _ = require('lodash'),
    q = require('q'),
    uuid = require('node-uuid'),
    User = require('../security/user'),
    Repository = require('./repository'),
    InternalError = require('kuzzle-common-objects').Errors.internalError;


  function UserRepository (opts) {
    var options = opts || {};

    if (options.ttl !== undefined) {
      this.ttl = options.ttl;
    }
  }

  UserRepository.prototype = new Repository(kuzzle, {
    index: kuzzle.config.internalIndex,
    collection: 'users',
    ObjectConstructor: User,
    cacheEngine: kuzzle.services.list.userCache
  });

  UserRepository.prototype.load = function (id) {
    if (id === 'anonymous' || id === -1) {
      return this.anonymous();
    }

    return Repository.prototype.load.call(this, id);
  };

  UserRepository.prototype.persist = function (user, opts) {
    var
      options = opts || {},
      databaseOptions = options.database || {},
      cacheOptions = options.cache || {};

    if (user._id === undefined || user._id === null) {
      user._id = uuid.v4();
    }

    return this.persistToDatabase(user, databaseOptions)
      .then(() => this.persistToCache(user, cacheOptions))
      .then(() => q(user));
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
    var result;

    if (!_.isObject(data)) {
      return q(user);
    }

    return Repository.prototype.hydrate(user, data)
      .then(u => {
        result = u;

        if (u._id === undefined || u._id === null) {
          return this.anonymous()
            .then(anonymousUser => {
              result = anonymousUser;
              return anonymousUser.profile;
            });
        } 

        // if the user exists (have an _id) but no profile
        // set it to default
        if (!u.profile) {
          return kuzzle.repositories.profile.loadProfile('default');
        }

        return kuzzle.repositories.profile.loadProfile(u.profile);
      })
      .then((profile) => {
        if (!profile) {
          return q.reject(new InternalError('Could not find profile: ' + user.profile));
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

