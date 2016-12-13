var
  _ = require('lodash'),
  Promise = require('bluebird'),
  uuid = require('node-uuid'),
  User = require('../security/user'),
  Repository = require('./repository'),
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError;

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
}

UserRepository.prototype = Object.create(Repository.prototype);
UserRepository.prototype.constructor = UserRepository;

UserRepository.prototype.init = function userRepositoryInit () {
  Repository.prototype.init.call(this, {});
};

UserRepository.prototype.load = function userRepositoryLoad (id) {
  if (id === 'anonymous' || id === '-1') {
    return Promise.resolve(this.anonymous());
  }

  return Repository.prototype.load.call(this, id)
    .then(user => {
      if (user === null) {
        return null;
      }
      return this.hydrate(new User(), user);
    });
};

UserRepository.prototype.persist = function userRepositoryPersist (user, opts) {
  var
    options = opts || {},
    databaseOptions = options.database || {},
    cacheOptions = options.cache || {};

  if (user._id === undefined || user._id === null) {
    user._id = uuid.v4();
  }

  return this.persistToDatabase(user, databaseOptions)
    .then(() => this.persistToCache(user, cacheOptions))
    .then(() => user);
};

/**
 * @returns User
 */
UserRepository.prototype.anonymous = function userRepositoryAnonymous () {
  var user = new User();

  return Object.assign(user, {
    _id: '-1',
    name: 'Anonymous',
    profileIds: ['anonymous']
  });
};

UserRepository.prototype.hydrate = function userRepositoryHydrate (user, data) {
  var source, dataprofileIds;

  if (!data || typeof data !== 'object') {
    return Promise.resolve(user);
  }

  if (data._source) {
    source = data._source;
    delete data._source;
    Object.assign(data, source);
  }

  if (data.profileIds) {
    if (!Array.isArray(data.profileIds)) {
      data.profileIds = [data.profileIds];
    }

    dataprofileIds = data.profileIds;
    delete data.profileIds;
  }

  Object.assign(user, data);
  Object.assign(user.profileIds, dataprofileIds);

  if (user._id === undefined || user._id === null) {
    return Promise.resolve(this.anonymous());
  }

  // if the user exists (have an _id) but no profile
  // set it to default
  if (user.profileIds.length === 0) {
    user.profileIds = ['default'];
  }

  return this.kuzzle.repositories.profile.loadProfiles(user.profileIds)
    .then(profiles => {
      var
        profileIds = profiles.map(profile => profile._id),
        profilesNotFound = _.difference(user.profileIds, profileIds);

      // Fail if not all roles are found
      if (profilesNotFound.length) {
        return Promise.reject(new NotFoundError(`Unable to hydrate the user ${data._id}. The following profiles don't exist: ${profilesNotFound}`));
      }

      return user;
    });
};

UserRepository.prototype.serializeToCache = function userRepositorySerializeToCache (user) {
  // avoid to mutate the user object
  return Object.assign({}, user);
};

UserRepository.prototype.serializeToDatabase = function userRepositorySerializeToDatabase (user) {
  var result = this.serializeToCache(user);

  delete result._id;

  return result;
};

module.exports = UserRepository;
