const
  Bluebird = require('bluebird'),
  should = require('should'),
  sinon = require('sinon'),
  KuzzleMock = require('../../../../mocks/kuzzle.mock'),
  Repository = require('../../../../../lib/api/core/models/repositories/repository'),
  User = require('../../../../../lib/api/core/models/security/user'),
  UserRepository = require('../../../../../lib/api/core/models/repositories/userRepository'),
  {
    BadRequestError,
    InternalError: KuzzleInternalError,
    NotFoundError,
  } = require('kuzzle-common-objects').errors;

describe('Test: repositories/userRepository', () => {
  let
    kuzzle,
    userRepository,
    userInCache,
    userInDB,
    userInvalidProfile,
    repositoryLoadStub;

  beforeEach(() => {
    const
      encryptedPassword = '5c4ec74fd64bb57c05b4948f3a7e9c7d450f069a';

    repositoryLoadStub = sinon.stub(Repository.prototype, 'load');

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

    repositoryLoadStub.returns(Bluebird.resolve(null));
    repositoryLoadStub
      .withArgs('userInCache')
      .returns(Bluebird.resolve(userInCache));
    repositoryLoadStub
      .withArgs('userInDB')
      .returns(Bluebird.resolve(userInDB));
    repositoryLoadStub
      .withArgs('userInvalidProfile')
      .returns(Bluebird.resolve(userInvalidProfile));

    kuzzle = new KuzzleMock();
    kuzzle.repositories.profile.loadProfiles.callsFake((...args) => Bluebird.resolve(args[0].map(id => ({_id: id}))));

    userRepository = new UserRepository(kuzzle);

    return userRepository.init();
  });

  afterEach(() => {
    repositoryLoadStub.restore();
  });

  describe('#constructor', () => {
    it('should take into account the options given', () => {
      const repository = new UserRepository(kuzzle, { ttl: 1000 });

      should(repository.ttl).be.exactly(1000);
    });
  });

  describe('#anonymous', () => {
    it('should return a valid anonymous user', () => {
      return userRepository.anonymous()
        .then(user => assertIsAnonymous(user));
    });
  });

  describe('#fromDTO', () => {
    it('should return the anonymous user if no _id is set', () => {
      return userRepository.fromDTO({profileIds: 'a profile'})
        .then(user => assertIsAnonymous(user));
    });

    it('should convert a profileIds string into array', () => {
      return userRepository.fromDTO({_id: 'admin', profileIds: 'admin'})
        .then(result => {
          should(result.profileIds).be.an.instanceOf(Array);
          should(result.profileIds[0]).be.exactly('admin');
        });
    });

    it('should reject the promise if the profile cannot be found', () => {
      kuzzle.repositories.profile.loadProfiles.resolves([null]);

      return should(userRepository.fromDTO(userInvalidProfile))
        .be.rejectedWith(NotFoundError);
    });

    it('should add the default profile if none is set', () => {
      return userRepository.fromDTO({_id: 'foo'})
        .then(user => should(user.profileIds).match(kuzzle.config.security.restrictedProfileIds));
    });
  });

  describe('#load', () => {
    it('should return the anonymous user when the anonymous or -1 id is given', () => {
      return Bluebird.all([
        userRepository.load('-1'),
        userRepository.load('anonymous')
      ])
        .then(users => {
          users.every(user => { assertIsAnonymous(user); });
        });
    });

    it('should resolve to user if good credentials are given', () => {
      kuzzle.repositories.profile.loadProfiles.returns(Bluebird.resolve([
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
      userRepository.load = () => Bluebird.reject(new KuzzleInternalError('Error'));

      return should(userRepository.load('userInCache')
        .catch(err => {
          delete userRepository.load;

          return Bluebird.reject(err);
        })).be.rejectedWith(KuzzleInternalError);
    });
  });

  describe('#serializeToCache', () => {
    it('should return a valid plain object', () => {
      return userRepository.anonymous()
        .then(user => {
          const result = userRepository.serializeToCache(user);

          should(result).not.be.an.instanceOf(User);
          should(result).be.an.Object();
          should(result._id).be.exactly('-1');
          should(result.profileIds).be.an.Array();
          should(result.profileIds[0]).be.exactly('anonymous');
        });
    });
  });

  describe('#persist', () => {
    it('should compute a user id if not set', () => {
      const user = new User();
      user.name = 'John Doe';
      user.profileIds = ['a profile'];

      userRepository.persist(user);

      should(user._id).not.be.empty();
      should(user._id).match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('should reject if we try to remove the anonymous profile from the anonymous user', () => {
      return should(userRepository.anonymous()
        .then(user => {
          user.profileIds = ['test'];
          return userRepository.persist(user);
        }))
        .be.rejectedWith(BadRequestError, {message: 'Anonymous user must be assigned the anonymous profile'});
    });
  });

  describe('#delete', () => {
    it('should throw an error when no user id is given', done => {
      userRepository.delete({ profileIds: [], name: 'gordon' })
        .then(() => done(new Error('should throw error')))
        .catch(error => {
          should(error).be.instanceOf(BadRequestError);
          done();
        });
    });

    it('should delete user from both cache and database', () => {
      return userRepository.delete({ _id: 'alyx' })
        .then(() => {
          should(kuzzle.services.list.internalCache.del)
            .calledOnce()
            .calledWith(userRepository.getCacheKey('alyx'));

          should(kuzzle.internalEngine.delete)
            .calledOnce()
            .calledWith(userRepository.collection, 'alyx');
        });
    });

    it('should delete user credentials', () => {
      const
        user = { _id: 'kleiner' },
        existsMethod = sinon.stub().resolves(true),
        deleteMethod = sinon.stub().resolves();
      kuzzle.pluginsManager.listStrategies.returns(['someStrategy']);

      kuzzle.pluginsManager.getStrategyMethod
        .onFirstCall().returns(existsMethod)
        .onSecondCall().returns(deleteMethod);

      return userRepository.delete(user)
        .then(response => {
          should(response).be.instanceof(Object);
          should(response._id).be.exactly('kleiner');
        });
    });

    it('should forward refresh option', () => {
      const
        user = { _id: 'mossman' },
        options = { refresh: 'wait_for' };

      return userRepository.delete(user, options)
        .then(() => {
          should(kuzzle.internalEngine.delete.firstCall.args[2]).match(options);
        });
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
