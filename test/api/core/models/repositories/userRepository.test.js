var
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
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError,
  NotFoundError = require.main.require('kuzzle-common-objects').Errors.notFoundError,
  ResponseObject = require.main.require('kuzzle-common-objects').Models.responseObject,
  Profile = require.main.require('lib/api/core/models/security/profile'),
  User = require.main.require('lib/api/core/models/security/user'),
  Repository = require.main.require('lib/api/core/models/repositories/repository'),
  UserRepository = require.main.require('lib/api/core/models/repositories/userRepository')(kuzzle),
  userRepository,
  userInvalidProfile;

before(function (done) {
  var
    encryptedPassword = '5c4ec74fd64bb57c05b4948f3a7e9c7d450f069a',
    mockCacheEngine,
    mockReadEngine,
    mockWriteLayer,
    mockProfileRepository,
    userInCache,
    userInDB,
    forwardedResult;

  mockCacheEngine = {
    get: function (key) {
      if (key === userRepository.index + '/' + userRepository.collection + '/userInCache') {
        return q(JSON.stringify(userInCache));
      }
      return q(null);
    },
    volatileSet: function (key, value, ttl) { forwardedResult = {key: key, value: JSON.parse(value), ttl: ttl }; return q('OK'); },
    expire: function (key, ttl) { forwardedResult = {key: key, ttl: ttl}; return q('OK'); }
  };

  mockReadEngine = {
    get: function (requestObject) {
      if (requestObject.data._id === 'userInDB') {
        return q(new ResponseObject(requestObject, userInDB));
      }

      return q(new NotFoundError('User not found in db'));
    }
  };

  mockWriteLayer = {
    execute: () => q({})
  };

  mockProfileRepository = {
    loadProfile: function (profileKey) {
      var profile = new Profile();
      if (profileKey === 'notfound') {
        return q(null);
      }
      profile._id = profileKey;
      return q(profile);
    }
  };
  userInCache = {
    _id: 'userInCache',
    name: 'Johnny Cash',
    profile: 'userincacheprofile',
    password: encryptedPassword
  };
  userInDB = {
    _id: 'userInDB',
    name: 'Debbie Jones',
    profile: 'userindbprofile'
  };
  userInvalidProfile = {
    _id: 'userInvalidProfile',
    profile: 'notfound'
  };

  userRepository = new UserRepository();
  userRepository.cacheEngine = mockCacheEngine;
  userRepository.readEngine = mockReadEngine;
  userRepository.writeLayer = mockWriteLayer;

  kuzzle.repositories = {};
  kuzzle.repositories.profile = mockProfileRepository;

  done();
});

describe('Test: repositories/userRepository', function () {
  describe('#constructor', () => {
    it('should take into account the options given', () => {
      var repository = new UserRepository({ ttl: 1000 });

      should(repository.ttl).be.exactly(1000);
    });
  });

  describe('#anonymous', function () {
    it('should return a valid anonymous user', function () {
      return userRepository.anonymous()
        .then(user => assertIsAnonymous(user));
    });
  });

  describe('#hydrate', function () {
    it('should return the given user if the given data is not a valid object', function (done) {
      var
        u = new User();

      q.all([
        userRepository.hydrate(u, null),
        userRepository.hydrate(u),
        userRepository.hydrate(u, 'a scalar')
      ])
        .then(function (results) {
          results.forEach(user => should(user).be.exactly(u));
          done();
        });
    });

    it('should return the anonymous user if no _id is set', () => {
      var user = new User();
      user.profile = new Profile();
      user.profile._id = 'a profile';

      return userRepository.hydrate(user, {})
        .then(result => assertIsAnonymous(result));
    });

    it('should reject the promise if an error is thrown by the prototype hydrate call', () => {
      var
        protoHydrate = Repository.prototype.hydrate,
        user = new User();

      Repository.prototype.hydrate = () => q.reject(new InternalError('Error'));

      return should(userRepository.hydrate(user, {})
        .catch(err => {
          Repository.prototype.hydrate = protoHydrate;

          return q.reject(err);
        })).be.rejectedWith(InternalError);
    });

    it('should reject the promise if the profile cannot be found', () => {
      var user = new User();

      return should(userRepository.hydrate(user, userInvalidProfile))
        .be.rejectedWith(InternalError);
    });
  });

  describe('#load', function () {
    it('should return the anonymous user when the anonymous or -1 id is given', done => {
      q.all([
        userRepository.load(-1),
        userRepository.load('anonymous')
      ])
        .then(users => {
          users.every(user => { assertIsAnonymous(user); });

          done();
        })
        .catch(error => { done(error); });
    });

  });
  
  describe('#load', function () {
    it('should resolve to user if good credentials are given', () => {
      return userRepository.load('userInCache')
        .then(user => {
          should(user._id).be.exactly('userInCache');
          should(user.name).be.exactly('Johnny Cash');
          should(user.profile).be.an.instanceOf(Profile);
          should(user.profile._id).be.exactly('userincacheprofile');
        });
    });

    it('should resolve to "null" if username is not found', () => {
      return userRepository.load('unknownUser')
        .then(user => should(user).be.null());
    });

    it('should reject the promise if an error occurred while fetching the user', () => {
      userRepository.load = () => q.reject(new InternalError('Error'));

      return should(userRepository.load('userInCache')
        .catch(err => {
          delete userRepository.load;

          return q.reject(err);
        })).be.rejectedWith(InternalError);
    });
  });

  describe('#serializeToCache', function () {
    it('should return a valid plain object', () => {
      return userRepository.anonymous()
        .then(user => {
          var result = userRepository.serializeToCache(user);

          should(result).not.be.an.instanceOf(User);
          should(result).be.an.Object();
          should(result._id).be.exactly(-1);
          should(result.profile).be.a.String();
          should(result.profile).be.exactly('anonymous');
        });
    });
  });

  describe('#persist', () => {
    it('should compute a user id if not set', () => {
      var user = new User();
      user.name = 'John Doe';
      user.profile = new Profile();
      user.profile._id = 'a profile';

      userRepository.persist(user);

      should(user._id).not.be.empty();
      should(user._id).match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
  });

  describe('#defaultProfile', () => {
    it('should add the default profile when the user do not have any profile set', () => {
      var
        userRepository = new UserRepository(),
        user = new User();

      user.name = 'No Profile';
      user._id = 'NoProfile';

      return userRepository.hydrate(user, {})
        .then(result => should(result.profile._id).be.eql('default'));
    });
  });
});

function assertIsAnonymous (user) {
  should(user._id).be.exactly(-1);
  should(user.name).be.exactly('Anonymous');
  should(user.profile).be.an.instanceOf(Profile);
  should(user.profile._id).be.exactly('anonymous');
}
