var
  Promise = require('bluebird'),
  _ = require('lodash'),
  should = require('should'),
  Kuzzle = require.main.require('lib/api/kuzzle'),
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError,
  NotFoundError = require.main.require('kuzzle-common-objects').Errors.notFoundError,
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
      mockDatabaseEngine,
      mockProfileRepository,
      userInCache,
      userInDB;

    kuzzle = new Kuzzle();
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

    mockDatabaseEngine = {
      get: (type, id) => {
        if (id === 'userInDB') {
          return Promise.resolve(userInDB);
        }

        return Promise.resolve(new NotFoundError('User not found in db'));
      },
      createOrReplace: () => Promise.resolve({})
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
      profileIds: ['userincacheprofile'],
      password: encryptedPassword
    };
    userInDB = {
      _id: 'userInDB',
      name: 'Debbie Jones',
      profileIds: ['userindbprofile']
    };
    userInvalidProfile = {
      _id: 'userInvalidProfile',
      profileIds: ['notfound']
    };

    kuzzle.repositories.profile = mockProfileRepository;

    userRepository = new UserRepository(kuzzle);
    userRepository.cacheEngine = mockCacheEngine;
    userRepository.databaseEngine = mockDatabaseEngine;

  });

  describe('#constructor', () => {
    it('should take into account the options given', () => {
      var repository = new UserRepository(kuzzle, { ttl: 1000 });

      should(repository.ttl).be.exactly(1000);
    });
  });

  describe('#anonymous', () => {
    it('should return a valid anonymous user', () => {
      return userRepository.anonymous()
        .then(user => assertIsAnonymous(user));
    });
  });

  describe('#hydrate', () => {
    it('should return the given user if the given data is not a valid object', () => {
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
      user.profileIds = 'a profile';

      return userRepository.hydrate(user, {})
        .then(result => assertIsAnonymous(result));
    });

    it('should convert a profileIds string into array', () => {
      var user = new User();
      user._id = 'admin';

      return userRepository.hydrate(user, {profileIds: 'admin'})
        .then((result) => {
          should(result.profileIds).be.an.instanceOf(Array);
          should(result.profileIds[0]).be.exactly('admin');
        });
    });

    it('should reject the promise if the profile cannot be found', () => {
      var user = new User();

      return should(userRepository.hydrate(user, userInvalidProfile))
        .be.rejectedWith(NotFoundError);
    });
  });

  describe('#load', () => {
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
          should(user.profileIds).be.an.Array();
          should(user.profileIds[0]).be.exactly('userincacheprofile');
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

  describe('#serializeToCache', () => {
    it('should return a valid plain object', () => {
      return userRepository.anonymous()
        .then(user => {
          var result = userRepository.serializeToCache(user);

          should(result).not.be.an.instanceOf(User);
          should(result).be.an.Object();
          should(result._id).be.exactly(-1);
          should(result.profileIds).be.an.Array();
          should(result.profileIds[0]).be.exactly('anonymous');
        });
    });
  });

  describe('#persist', () => {
    it('should compute a user id if not set', () => {
      var user = new User();
      user.name = 'John Doe';
      user.profileIds = ['a profile'];

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
          return should(result.profileIds[0]).be.eql('default');
        });
    });
  });
});

function assertIsAnonymous (user) {
  should(user._id).be.exactly(-1);
  should(user.name).be.exactly('Anonymous');
  should(user.profileIds).be.an.instanceOf(Array);
  should(user.profileIds[0]).be.exactly('anonymous');
}
