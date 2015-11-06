var
  jwt = require('jsonwebtoken'),
  q = require('q'),
  should = require('should'),
  params = require('rc')('kuzzle'),
  kuzzle = {
    repositories: {},
    services: {
      list: {}
    },
    config: require.main.require('lib/config')(params)
  },
  NotFoundError = require.main.require('lib/api/core/errors/notFoundError'),
  UnauthorizedError = require.main.require('lib/api/core/errors/unauthorizedError'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  User = require.main.require('lib/api/core/models/security/user'),
  UserRepository = require.main.require('lib/api/core/models/repositories/userRepository')(kuzzle),
  userRepository;

before(function (done) {
  var
    mockCacheEngine,
    mockReadEngine,
    mockProfileRepository,
    userInCache,
    userInDB,
    forwardedResult;

  mockCacheEngine = {
    get: function (key) {
      if (key === userRepository.collection + '/userInCache') {
        return Promise.resolve(userInCache);
      }
      return Promise.resolve(null);
    },
    volatileSet: function (key, value, ttl) { forwardedResult = {key: key, value: value, ttl: ttl }; },
    expire: function (key, ttl) { forwardedResult = {key: key, ttl: ttl}; }
  };
  mockReadEngine = {
    get: function (requestObject) {
      if (requestObject.data._id === 'userInDB') {
        return Promise.resolve(new ResponseObject(requestObject, userInDB));
      }

      return Promise.resolve(new NotFoundError('User not found in db'));
    }
  };
  mockProfileRepository = {
    loadProfile: function (profileKey) {
      var profile = new Profile();
      profile._id = profileKey;
      return Promise.resolve(profile);
    }
  };
  userInCache = {
    _id: 'userInCache',
    name: 'Johnny Cash',
    profile: 'userincacheprofile'
  };
  userInDB = {
    _id: 'userInDB',
    name: 'Debbie Jones',
    profile: 'userindbprofile'
  };

  userRepository = new UserRepository();
  userRepository.cacheEngine = mockCacheEngine;
  userRepository.readEngine = mockReadEngine;

  kuzzle.repositories = {};
  kuzzle.repositories.profile = mockProfileRepository;

  done();
});

describe('Test: repositories/userRepository', function () {
  describe('#anonymous', function () {
    it('should return a valid anonymous user', function (done) {
      userRepository.anonymous()
        .then(function (user) {
          assertIsAnonymous(user);
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });
  });

  describe('#admin', function (done) {
    it('should return the admin user', function (done) {
      userRepository.admin()
        .then(function (user) {
          should(user).be.an.instanceOf(User);
          should(user._id).be.exactly('admin');
          should(user.name).be.exactly('Administrator');
          should(user.profile).be.an.instanceOf(Profile);
          should(user.profile._id).be.exactly('admin');

          done();
        })
        .catch(function (error) {
          done(error);
        });
    });
  });

  describe('#hydrate', function () {
    it('should return the anonymous user if the given data is not a valid object', function (done) {
      var
        u = new User();

      q.all([
        userRepository.hydrate(u, null),
        userRepository.hydrate(u),
        userRepository.hydrate(u, 'a scalar')
      ])
        .then(function (results) {
          results.forEach(function (user) {
            assertIsAnonymous(user);
          });
          done();
        });
    });
  });

  describe('#loadFromToken', function () {
    it('should reject the promise if the jwt is invalid', function () {
      return should(userRepository.loadFromToken('invalidToken')).be.rejectedWith(UnauthorizedError, {details: {subCode: UnauthorizedError.prototype.subCodes.JsonWebTokenError, description: 'jwt malformed'}});
    });

    it('should load the anonymous user if the uuid is not known', function (done) {
      var
        token;

      token = jwt.sign({_id: -99999}, params.jsonWebToken.secret, {algorithm: params.jsonWebToken.algorithm});

      userRepository.loadFromToken(token)
        .then(function (user) {
          assertIsAnonymous(user);
          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    it('shoud reject the promise if the jwt is expired', function (done) {
      var token = jwt.sign({_id: -1}, params.jsonWebToken.secret, {algorithm: params.jsonWebToken.algorithm, expiresIn: 1});

      setTimeout(function () {
        should(userRepository.loadFromToken(token)).be.rejectedWith(UnauthorizedError, {details: {subCode: UnauthorizedError.prototype.subCodes.TokenExpired}});
        done();
      }, 1001);
    });

    it('should load the admin user if the user id is "admin"', function (done) {
      var token = jwt.sign({_id: 'admin'}, params.jsonWebToken.secret, {algorithm: params.jsonWebToken.algorithm});

      userRepository.loadFromToken(token)
        .then(function (user) {
          should(user).be.an.instanceOf(User);
          should(user._id).be.exactly('admin');
          should(user.name).be.exactly('Administrator');
          should(user.profile).be.an.instanceOf(Profile);
          should(user.profile._id).be.exactly('admin');

          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    it('should load the user from cache', function (done) {
      var token = jwt.sign({_id: 'userInCache'}, params.jsonWebToken.secret, {algorithm: params.jsonWebToken.algorithm});

      userRepository.loadFromToken(token)
        .then(function (user) {
          should(user._id).be.exactly('userInCache');
          should(user.name).be.exactly('Johnny Cash');
          should(user.profile).be.an.instanceOf(Profile);
          should(user.profile._id).be.exactly('userincacheprofile');

          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    it('should load the user from db', function (done) {
      var token = jwt.sign({_id: 'userInDB'}, params.jsonWebToken.secret, {algorithm: params.jsonWebToken.algorithm});

      userRepository.loadFromToken(token)
        .then(function (user) {
          should(user._id).be.exactly('userInDB');
          should(user.name).be.exactly('Debbie Jones');
          should(user.profile).be.an.instanceOf(Profile);
          should(user.profile._id).be.exactly('userindbprofile');

          done();
        })
        .catch(function (error) {
          done(error);
        });
    });
  });

  describe('#serializeToCache', function () {
    it('should return a valid plain object', function (done) {
      userRepository.anonymous()
        .then(function (user) {
          var result = userRepository.serializeToCache(user);

          should(result).not.be.an.instanceOf(User);
          should(result).be.an.Object();
          should(result._id).be.exactly(-1);
          should(result.profile).be.a.String();
          should(result.profile).be.exactly('anonymous');

          done();
        })
        .catch(function (error) {
          done(error);
        });
    });
  });

});

function assertIsAnonymous (user) {
  should(user._id).be.exactly(-1);
  should(user.name).be.exactly('Anonymous');
  should(user.profile).be.an.instanceOf(Profile);
  should(user.profile._id).be.exactly('anonymous');
}
