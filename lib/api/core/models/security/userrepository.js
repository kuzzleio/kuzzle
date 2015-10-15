var
  _ = require('lodash'),
  jwt = require('jsonwebtoken'),
  q = require('q'),
  uuid = require('node-uuid'),
  User = require('./user'),
  RequestObject = require('../requestObject');

function UserRepository (kuzzle) {
  this.kuzzle = kuzzle;
}

UserRepository.prototype.loadFromCache = function (uuid) {
  var
    o,
    deferred = q.defer(),
    userCacheKey = 'users:' + uuid;

  this.kuzzle.services.list.sessionCache.get(userCacheKey)
    .then(function (cachedUser) {
      if (cachedUser) {
        try{
          o = JSON.parse(cachedUser);
          deferred.resolve(new User(this).hydrate(o));
        }
        catch(error) {
          deferred.reject(error);
        }
      }
      else {
        deferred.resolve(null);
      }
    }.bind(this))
    .catch(function (error) {
      deferred.reject(error);
    });

  return deferred.promise;
};

UserRepository.prototype.loadFromDatabase = function (uuid) {
  var
    deferred = q.defer(),
    userDocumentId = 'user/' + uuid,
    requestObject = new RequestObject({
      controller: 'read',
      action: 'get',
      requestId: 'foo',
      collection: '_users',
      body: {
        _id: userDocumentId
      }
    });

  this.kuzzle.services.list.readEngine.get(requestObject)
    .then(function (result) {
      deferred.resolve(new User(this).hydrate(result.data));
    }.bind(this))
    .catch(function (error) {
      deferred.reject(error);
    });

  return deferred.promise;
};

UserRepository.prototype.loadFromToken = function (userToken) {
  var
    deferred = q.defer(),
    decodedToken;

  try {
    decodedToken = jwt.verify(userToken, this.kuzzle.config.jsonWebToken.secret);

    this.loadFromCache(decodedToken._id)
      .then(function (user) {
        if (user == null) {
          this.loadFromDatabase(decodedToken._id)
            .then(function (user) {
              if (user === null) {
                user = User.anonymous(this);
              }
              deferred.resolve(user);
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
  var
    deferred = q.defer(),
    requestObject,
    userCacheKey;

  requestObject = new RequestObject({
    controller: 'write',
    action: 'create',
    requestId: 'foo',
    collection: '_users'
  });

  if (user._id === undefined) {
    user._id = uuid.v1();
  }

  userCacheKey = 'users:' + user._id;

  requestObject.body = user;

  this.kuzzle.services.list.writeEngine.createOrUpdate(requestObject);

  this.kuzzle.services.list.sessionCache.set(userCacheKey, user)
    .then(function (result) {
      deferred.resolve(result === 'OK');
    })
    .catch(function (error) {
      deferred.reject(error);
    });

  return deferred.promise;
};


module.exports = UserRepository;
