'use strict';

const Bluebird = require('bluebird');
const should = require('should');
const sinon = require('sinon').createSandbox();
const KuzzleMock = require('../../mocks/kuzzle.mock');
const Repository = require('../../../lib/core/shared/repository');
const User = require('../../../lib/model/security/user');
const ApiKey = require('../../../lib/model/storage/apiKey');
const UserRepository = require('../../../lib/core/security/userRepository');
const {
  errors: {
    BadRequestError,
    InternalError: KuzzleInternalError
  }
} = require('kuzzle-common-objects');

describe('Test: security/userRepository', () => {
  let kuzzle;
  let userRepository;
  let userInCache;
  let userInDB;
  let userInvalidProfile;
  let repositoryLoadStub;
  let profileRepositoryMock;
  let tokenRepositoryMock;

  beforeEach(() => {
    const encryptedPassword = '5c4ec74fd64bb57c05b4948f3a7e9c7d450f069a';

    profileRepositoryMock = {
      loadProfiles: sinon
        .stub()
        .callsFake(async (...args) => args[0].map(id => ({_id: id}))),
    };

    tokenRepositoryMock = {
      deleteByUserId: sinon.stub().resolves(),
    };

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

    repositoryLoadStub.resolves(null);
    repositoryLoadStub.withArgs('userInCache').resolves(userInCache);
    repositoryLoadStub.withArgs('userInDB').resolves(userInDB);
    repositoryLoadStub
      .withArgs('userInvalidProfile')
      .resolves(userInvalidProfile);

    kuzzle = new KuzzleMock();

    userRepository = new UserRepository(kuzzle, {
      profile: profileRepositoryMock,
      token: tokenRepositoryMock,
    });

    return userRepository.init({ indexStorage: kuzzle.internalIndex });
  });

  afterEach(() => {
    repositoryLoadStub.restore();
  });

  describe('#anonymous', () => {
    it('should return a valid anonymous user', async () => {
      kuzzle.ask.restore();

      const user = await kuzzle.ask('core:security:user:anonymous');
      assertIsAnonymous(user);
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

    it('should reject if the profile cannot be found', () => {
      profileRepositoryMock.loadProfiles.resolves([null]);

      return should(userRepository.fromDTO(userInvalidProfile))
        .be.rejectedWith(KuzzleInternalError, {
          id: 'security.user.cannot_hydrate'
        });
    });

    it('should reject if the user has no profile associated to it', () => {
      return should(userRepository.fromDTO({_id: 'foo'})).rejectedWith(
        KuzzleInternalError,
        { id: 'security.user.no_profile' });
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

    it('should resolve to user if good credentials are given', async () => {
      profileRepositoryMock.loadProfiles.resolves([
        {_id: userInCache.profileIds[0]}
      ]);

      const user = await userRepository.load('userInCache');

      should(user._id).be.exactly('userInCache');
      should(user.name).be.exactly('Johnny Cash');
      should(user.profileIds).be.an.Array();
      should(user.profileIds[0]).be.exactly('userincacheprofile');
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
      const result = userRepository
        .serializeToCache(userRepository.anonymousUser);

      should(result).not.be.an.instanceOf(User);
      should(result).be.an.Object();
      should(result._id).be.exactly('-1');
      should(result.profileIds).be.an.Array();
      should(result.profileIds[0]).be.exactly('anonymous');
    });
  });

  describe('#persist', () => {
    beforeEach(() => {
      sinon.stub(userRepository, 'persistToDatabase').resolves();
      sinon.stub(userRepository, 'persistToCache').resolves();
    });

    it('should persist in both the db and the cache with default options', async () => {
      const user = {_id: 'foo', profileIds: ['bar']};

      await userRepository.persist(user);

      should(userRepository.persistToDatabase).calledWith(user, {});
      should(userRepository.persistToCache).calledWith(user, {});
    });

    it('should persist in both the db and the cache and forward options', async () => {
      const user = {_id: 'foo', profileIds: ['bar']};
      const opts = {
        cache: {baz: 'qux'},
        database: {foo: 'bar'},
      };

      await userRepository.persist(user, opts);

      should(userRepository.persistToDatabase).calledWith(user, opts.database);
      should(userRepository.persistToCache).calledWith(user, opts.cache);
    });

    it('should reject if we try to remove the anonymous profile from the anonymous user', () => {
      return should(userRepository.persist({_id: '-1', profileIds: ['test']}))
        .be.rejectedWith(BadRequestError, {
          id: 'security.user.anonymous_profile_required'
        });
    });
  });

  describe('#delete', () => {
    let deleteByUserStub;

    beforeEach(() => {
      deleteByUserStub = sinon.stub(ApiKey, 'deleteByUser');
    });

    afterEach(() => {
      deleteByUserStub.restore();
    });

    it('should delete user from both cache and database', async () => {
      const user = { _id: 'alyx' };

      await userRepository.delete(user, { refresh: 'wait_for' });

      should(userRepository.cacheEngine.del)
        .calledOnce()
        .calledWith(userRepository.getCacheKey('alyx'));

      should(userRepository.indexStorage.delete)
        .calledOnce()
        .calledWith(userRepository.collection, 'alyx', { refresh: 'wait_for' });

      should(deleteByUserStub).be.calledWith(user, { refresh: 'wait_for' });
    });

    it('should delete user credentials', async () => {
      const user = { _id: 'kleiner' };
      const existsMethod = sinon.stub().resolves(true);
      const deleteMethod = sinon.stub().resolves();

      kuzzle.pluginsManager.listStrategies.returns(['someStrategy']);

      kuzzle.pluginsManager.getStrategyMethod
        .onFirstCall().returns(existsMethod)
        .onSecondCall().returns(deleteMethod);

      await userRepository.delete(user);

      should(existsMethod)
        .calledOnce()
        .calledWithMatch(
          { input: { resource: { _id: 'kleiner' } } },
          'kleiner',
          'someStrategy');

      should(deleteMethod)
        .calledOnce()
        .calledWithMatch(
          { input: { resource: { _id: 'kleiner' } } },
          'kleiner',
          'someStrategy');
    });

    it('should delete associated ApiKey', async () => {
      const user = { _id: 'alyx' };

      await userRepository.delete(user, { refresh: 'wait_for' });

      should(deleteByUserStub).be.calledWith(user, { refresh: 'wait_for' });
    });

    it('should forward refresh option', () => {
      const
        user = { _id: 'mossman' },
        options = { refresh: 'wait_for' };

      return userRepository.delete(user, options)
        .then(() => {
          should(userRepository.indexStorage.delete.firstCall.args[2]).match(options);
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
