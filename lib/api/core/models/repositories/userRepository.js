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

    return Repository.prototype.load.call(this, id)
      .then(user => {
        if (user === null) {
          return q(null);
        }
        return this.hydrate(new User(), user);
      });
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

    return q(_.assignIn(user, {
      _id: -1,
      name: 'Anonymous',
      profileId: 'anonymous'
    }));
  };

  UserRepository.prototype.hydrate = function (user, data) {
    var
      result,
      source;

    if (!_.isObject(data)) {
      return q(user);
    }

    if (data._source) {
      source = data._source;
      delete data._source;
      Object.assign(data, source);
    }

    return q(_.assignIn(user, data))
      .then(u => {
        result = u;

        if (result._id === undefined || result._id === null) {
          return this.anonymous()
            .then(anonymousUser => {
              result = anonymousUser;
              return q(anonymousUser.profileId);
            });
        }

        // if the user exists (have an _id) but no profile
        // set it to default
        if (!result.profileId) {
          result.profileId = 'default';
        }

        return kuzzle.repositories.profile.loadProfile(result.profileId);
      })
      .then((profile) => {
        if (!profile) {
          return q.reject(new InternalError('Could not find profile: ' + user.profileId));
        }

        return result;
      });
  };

  UserRepository.prototype.serializeToCache = function (user) {
    return _.assign({}, user);
  };

  UserRepository.prototype.serializeToDatabase = function (user) {
    var result = this.serializeToCache(user);

    delete result._id;

    return result;
  };

  return UserRepository;

};

