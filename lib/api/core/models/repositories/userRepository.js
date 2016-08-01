var
  _ = require('lodash'),
  Promise = require('bluebird'),
  uuid = require('node-uuid'),
  User = require('../security/user'),
  Repository = require('./repository'),
  NotFoundError = require('kuzzle-common-objects').Errors.notFoundError;

/**
 * @class UserRepository
 * @extends Repository
 * @param {Kuzzle} kuzzle
 * @param opts
 * @constructor
 */
function UserRepository (kuzzle, opts) {
  Repository.apply(this, arguments);
  this.collection = 'users';
  this.ObjectConstructor = User;

  if (opts !== undefined && opts.ttl !== undefined) {
    this.ttl = opts.ttl;
  }

  UserRepository.prototype.init = function() {
    Repository.prototype.init.call(this, {
      cacheEngine: kuzzle.services.list.securityCache
    });
  };

  UserRepository.prototype.load = function (id) {
    if (id === 'anonymous' || id === -1) {
      return this.anonymous();
    }

    return Repository.prototype.load.call(this, id)
      .then(user => {
        if (user === null) {
          return null;
        }
        return this.hydrate(new User(), user);
      });
  };

  UserRepository.prototype.persist = function (user, popts) {
    var
      options = popts || {},
      databaseOptions = options.database || {},
      cacheOptions = options.cache || {};

    if (user._id === undefined || user._id === null) {
      user._id = uuid.v4();
    }

    return this.persistToDatabase(user, databaseOptions)
      .then(() => this.persistToCache(user, cacheOptions))
      .then(() => user);
  };


  UserRepository.prototype.anonymous = function () {
    var
      user = new User();

    return Promise.resolve(_.assignIn(user, {
      _id: -1,
      name: 'Anonymous',
      profilesIds: ['anonymous']
    }));
  };

  UserRepository.prototype.hydrate = function (user, data) {
    var source, dataProfilesIds;

    if (!_.isObject(data)) {
      return Promise.resolve(user);
    }

    if (data._source) {
      source = data._source;
      delete data._source;
      Object.assign(data, source);
    }

    if (data.profilesIds) {
      dataProfilesIds = data.profilesIds;
      delete data.profilesIds;
    }

    _.assignIn(user, data);
    _.assign(user.profilesIds, dataProfilesIds);

    if (user._id === undefined || user._id === null) {
      return this.anonymous();
    }

    // if the user exists (have an _id) but no profile
    // set it to default
    if (user.profilesIds.length === 0) {
      user.profilesIds = ['default'];
    }

    return kuzzle.repositories.profile.loadProfiles(user.profilesIds)
      .then(profiles => {
        var
          profilesIds = profiles.map(profile => profile._id),
          profilesNotFound = _.difference(user.profilesIds, profilesIds);

        // Fail if not all roles are found
        if (profilesNotFound.length) {
          return Promise.reject(new NotFoundError(`Unable to hydrate the user ${data._id}. The following profiles don't exist: ${profilesNotFound}`));
        }

        return user;
      });
  };

  UserRepository.prototype.serializeToCache = function (user) {
    // avoid to mutate the user object
    return _.assign({}, user);
  };

  UserRepository.prototype.serializeToDatabase = function (user) {
    var result = this.serializeToCache(user);

    delete result._id;

    return result;
  };

}

UserRepository.prototype = new Repository();
UserRepository.prototype.constructor = UserRepository;

module.exports = UserRepository;
