var
  Promise = require('bluebird'),
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  KuzzleMock = require('../../../../mocks/kuzzle.mock'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  InternalError = require('kuzzle-common-objects').errors.InternalError,
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  Repository = require('../../../../../lib/api/core/models/repositories/repository'),
  User = require('../../../../../lib/api/core/models/security/user'),
  UserRepository = require('../../../../../lib/api/core/models/repositories/userRepository');

describe('Test: repositories/userRepository', () => {
  var
    kuzzle,
    userRepository,
    userInCache,
    userInDB,
    userInvalidProfile;

  beforeEach(() => {
    var
      encryptedPassword = '5c4ec74fd64bb57c05b4948f3a7e9c7d450f069a',
      repositoryLoadStub = sandbox.stub(Repository.prototype, 'load');

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

    repositoryLoadStub.returns(Promise.resolve(null));
    repositoryLoadStub
      .withArgs('userInCache')
      .returns(Promise.resolve(userInCache));
    repositoryLoadStub
      .withArgs('userInDB')
      .returns(Promise.resolve(userInDB));
    repositoryLoadStub
      .withArgs('userInvalidProfile')
      .returns(Promise.resolve(userInvalidProfile));

    kuzzle = new KuzzleMock();

    userRepository = new UserRepository(kuzzle);

    return userRepository.init();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#constructor', () => {
    it('should take into account the options given', () => {
      var repository = new UserRepository(kuzzle, { ttl: 1000 });

      should(repository.ttl).be.exactly(1000);
    });
  });

  describe('#anonymous', () => {
    it('should return a valid anonymous user', () => {
      var user = userRepository.anonymous();
      assertIsAnonymous(user);
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

      kuzzle.repositories.profile.loadProfiles.returns(Promise.resolve([
        {_id: 'admin'}
      ]));

      return userRepository.hydrate(user, {profileIds: 'admin'})
        .then((result) => {
          should(result.profileIds).be.an.instanceOf(Array);
          should(result.profileIds[0]).be.exactly('admin');
        });
    });

    it('should reject the promise if the profile cannot be found', () => {
      var user = new User();

      kuzzle.repositories.profile.loadProfiles.returns(Promise.resolve([]));

      return should(userRepository.hydrate(user, userInvalidProfile))
        .be.rejectedWith(NotFoundError);
    });

    it('should add the default profile if none is set', () => {
      var user = new User();
      user._id = 'foo';

      kuzzle.repositories.profile.loadProfiles.returns(Promise.resolve([
        {_id: 'default'}
      ]));

      userRepository.hydrate(user, {});

      should(user.profileIds)
        .match(kuzzle.config.security.restrictedProfileIds);

    });
  });

  describe('#load', () => {
    it('should return the anonymous user when the anonymous or -1 id is given', () => {
      return Promise.all([
        userRepository.load('-1'),
        userRepository.load('anonymous')
      ])
        .then(users => {
          users.every(user => { assertIsAnonymous(user); });
        });
    });

    it('should resolve to user if good credentials are given', () => {
      kuzzle.repositories.profile.loadProfiles.returns(Promise.resolve([
        {_id: userInCache.profileIds[0]}
      ]));

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
      var
        user = userRepository.anonymous(),
        result = userRepository.serializeToCache(user);

      should(result).not.be.an.instanceOf(User);
      should(result).be.an.Object();
      should(result._id).be.exactly('-1');
      should(result.profileIds).be.an.Array();
      should(result.profileIds[0]).be.exactly('anonymous');
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

    it('should reject if we try to remove the anonymous profile from the anonymous user', () => {
      const user = new User();
      user._id = '-1';
      user.profileIds = ['test'];

      return should(userRepository.persist(user))
        .be.rejectedWith(BadRequestError, {message: 'Anonymous user must be assigned the anonymous profile'});
    });
  });
});

function assertIsAnonymous (user) {
  should(user)
    .be.an.instanceOf(User);
  should(user._id).be.exactly('-1');
  should(user.name).be.exactly('Anonymous');
  should(user.profileIds).be.an.instanceOf(Array);
  should(user.profileIds[0]).be.exactly('anonymous');
}
