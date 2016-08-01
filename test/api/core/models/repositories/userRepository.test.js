var
  Promise = require('bluebird'),
  _ = require('lodash'),
  should = require('should'),
  KuzzleServer = require.main.require('lib/api/kuzzleServer'),
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError,
  NotFoundError = require.main.require('kuzzle-common-objects').Errors.notFoundError,
  ResponseObject = require.main.require('kuzzle-common-objects').Models.responseObject,
  Profile = require.main.require('lib/api/core/models/security/profile'),
  User = require.main.require('lib/api/core/models/security/user'),
  UserRepository = require.main.require('lib/api/core/models/repositories/userRepository');

describe('Test: repositories/userRepository', () => {
  var
    kuzzle,
    userRepository,
    userInvalidProfile;

  before(() => {
    var
      encryptedPassword = '5c4ec74fd64bb57c05b4948f3a7e9c7d450f069a',
      mockCacheEngine,
      mockReadEngine,
      mockWriteLayer,
      mockProfileRepository,
      userInCache,
      userInDB;

    kuzzle = new KuzzleServer();
    mockCacheEngine = {
      get: key => {
        if (key === userRepository.index + '/' + userRepository.collection + '/userInCache') {
          return Promise.resolve(JSON.stringify(userInCache));
        }
        return Promise.resolve(null);
      },
      volatileSet: () => {return Promise.resolve('OK');},
      expire: () => {return Promise.resolve('OK'); }
    };

    mockReadEngine = {
      get: requestObject => {
        if (requestObject.data._id === 'userInDB') {
          return Promise.resolve(new ResponseObject(requestObject, userInDB));
        }

        return Promise.resolve(new NotFoundError('User not found in db'));
      }
    };

    mockWriteLayer = {
      execute: () => Promise.resolve({})
    };

    mockProfileRepository = {
      loadProfile: profileKey => {
        var profile = new Profile();
        if (profileKey === 'notfound') {
          return Promise.resolve(null);
        }
        profile._id = profileKey;
        return Promise.resolve(profile);
      },
      loadProfiles: profileKeys => {
        var
          profile,
          profiles = [];

        profileKeys.forEach(profileKey => {
          profile = new Profile();
          if (profileKey !== 'notfound') {
            profile._id = profileKey;
            profiles.push(_.assignIn({}, profile));
          }
        });
        return Promise.resolve(profiles);
      }
    };
    userInCache = {
      _id: 'userInCache',
      name: 'Johnny Cash',
      profilesIds: ['userincacheprofile'],
      password: encryptedPassword
    };
    userInDB = {
      _id: 'userInDB',
      name: 'Debbie Jones',
      profilesIds: ['userindbprofile']
    };
    userInvalidProfile = {
      _id: 'userInvalidProfile',
      profilesIds: ['notfound']
    };

    kuzzle.repositories.profile = mockProfileRepository;

    userRepository = new UserRepository(kuzzle);
    userRepository.cacheEngine = mockCacheEngine;
    userRepository.readEngine = mockReadEngine;
    userRepository.writeLayer = mockWriteLayer;

  });

  describe('#constructor', () => {
    it('should take into account the options given', () => {
      var repository = new UserRepository(kuzzle, { ttl: 1000 });

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
    it('should return the given user if the given data is not a valid object', function () {
      var
        u = new User();

      return Promise.all([
        userRepository.hydrate(u, null),
        userRepository.hydrate(u),
        userRepository.hydrate(u, 'a scalar')
      ])
        .then(results => {
          results.forEach(user => should(user).be.exactly(u));
        });
    });

    it('should return the anonymous user if no _id is set', () => {
      var user = new User();
      user.profilesIds = 'a profile';

      return userRepository.hydrate(user, {})
        .then(result => assertIsAnonymous(result));
    });

    it('should reject the promise if the profile cannot be found', () => {
      var user = new User();

      return should(userRepository.hydrate(user, userInvalidProfile))
        .be.rejectedWith(NotFoundError);
    });
  });

  describe('#load', function () {
    it('should return the anonymous user when the anonymous or -1 id is given', () => {
      return Promise.all([
        userRepository.load(-1),
        userRepository.load('anonymous')
      ])
        .then(users => {
          users.every(user => { assertIsAnonymous(user); });
        });
    });

    it('should resolve to user if good credentials are given', () => {
      return userRepository.load('userInCache')
        .then(user => {
          should(user._id).be.exactly('userInCache');
          should(user.name).be.exactly('Johnny Cash');
          should(user.profilesIds).be.an.Array();
          should(user.profilesIds[0]).be.exactly('userincacheprofile');
        });
    });

    it('should resolve to "null" if username is not found', () => {
      return userRepository.load('unknownUser')
        .then(user => should(user).be.null());
    });

    it('should reject the promise if an error occurred while fetching the user', () => {
      userRepository.load = () => Promise.reject(new InternalError('Error'));

      return should(userRepository.load('userInCache')
        .catch(err => {
          delete userRepository.load;

          return Promise.reject(err);
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
          should(result.profilesIds).be.an.Array();
          should(result.profilesIds[0]).be.exactly('anonymous');
        });
    });
  });

  describe('#persist', () => {
    it('should compute a user id if not set', () => {
      var user = new User();
      user.name = 'John Doe';
      user.profilesIds = ['a profile'];

      userRepository.persist(user);

      should(user._id).not.be.empty();
      should(user._id).match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
  });

  describe('#defaultProfile', () => {
    it('should add the default profile when the user do not have any profile set', () => {
      var
        user = new User();

      userRepository = new UserRepository(kuzzle);

      user.name = 'No Profile';
      user._id = 'NoProfile';

      return userRepository.hydrate(user, {})
        .then(result => {
          return should(result.profilesIds[0]).be.eql('default');
        });
    });
  });
});

function assertIsAnonymous (user) {
  should(user._id).be.exactly(-1);
  should(user.name).be.exactly('Anonymous');
  should(user.profilesIds).be.an.instanceOf(Array);
  should(user.profilesIds[0]).be.exactly('anonymous');
}
