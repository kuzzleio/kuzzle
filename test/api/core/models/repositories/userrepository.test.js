var
  jwt = require('jsonwebtoken'),
  q = require('q'),
  should = require('should'),
  params = require('rc')('kuzzle'),
  kuzzle = {
    repositories: {},
    services: {
      list: {}
    }
  },
  NotFoundError = require.main.require('lib/api/core/errors/notFoundError'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject'),
  User = require.main.require('lib/api/core/models/security/user'),
  UserRepository = require.main.require('lib/api/core/models/repositories/userRepository')(kuzzle),
  userRepository;

before(function (done) {
  var
    mockCacheEngine,
    mockReadEngine,
    mockProfileRepository,
    userInCache,
    userInDB;

  mockCacheEngine = {
    get: function (key) {
      if (key === userRepository.collection + '/userInCache') {
        return Promise.resolve(userInCache);
      }

      return Promise.resolve(null);
    }
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
      return Promise.resolve({name: profileKey});
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

  kuzzle.config = params;
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
      var
        foo;
      foo = userRepository.loadFromToken('invalidToken');

      should(foo).be.rejected();
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

    it('should load the user from cache', function (done) {
      var token;

      token = jwt.sign({_id: 'userInCache'}, params.jsonWebToken.secret, {algorithm: params.jsonWebToken.algorithm});

      userRepository.loadFromToken(token)
        .then(function (user) {
          should(user._id).be.exactly('userInCache');
          should(user.name).be.exactly('Johnny Cash');
          should(user.profile.name).be.exactly('userincacheprofile');

          done();
        })
        .catch(function (error) {
          done(error);
        });
    });

    it('should load the user from db', function (done) {
      var token;

      token = jwt.sign({_id: 'userInDB'}, params.jsonWebToken.secret, {algorithm: params.jsonWebToken.algorithm});

      userRepository.loadFromToken(token)
        .then(function (user) {
          should(user._id).be.exactly('userInDB');
          should(user.name).be.exactly('Debbie Jones');
          should(user.profile.name).be.exactly('userindbprofile');

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
  should(user.profile.name).be.exactly('anonymous');
}
