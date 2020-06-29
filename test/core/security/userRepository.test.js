'use strict';

const should = require('should');
const sinon = require('sinon');
const {
  errors: {
    BadRequestError,
    InternalError: KuzzleInternalError
  }
} = require('kuzzle-common-objects');

const KuzzleMock = require('../../mocks/kuzzle.mock');

const Repository = require('../../../lib/core/shared/repository');
const User = require('../../../lib/model/security/user');
const ApiKey = require('../../../lib/model/storage/apiKey');
const UserRepository = require('../../../lib/core/security/userRepository');

describe.only('Test: security/userRepository', () => {
  let kuzzle;
  let userRepository;
  let profileRepositoryMock;
  let tokenRepositoryMock;

  beforeEach(() => {
    profileRepositoryMock = {
      loadProfiles: sinon
        .stub()
        .callsFake(async (...args) => args[0].map(id => ({_id: id}))),
    };

    tokenRepositoryMock = {
      deleteByKuid: sinon.stub().resolves(),
    };

    kuzzle = new KuzzleMock();
    kuzzle.ask.restore();

    userRepository = new UserRepository(kuzzle, {
      profile: profileRepositoryMock,
      token: tokenRepositoryMock,
    });

    return userRepository.init({ indexStorage: kuzzle.internalIndex });
  });

  describe('#anonymous', () => {
    it('should return a valid anonymous user', async () => {
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

      return should(userRepository.fromDTO({_id: 'foo', profileIds: ['nope']}))
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

  describe('#get', () => {
    const getEvent = 'core:security:user:get';

    beforeEach(() => {
      sinon.stub(Repository.prototype, 'load').resolves();
    });

    afterEach(() => {
      Repository.prototype.load.restore();
    });

    it('should register a "get" event', async () => {
      sinon.stub(userRepository, 'load');

      await kuzzle.ask(getEvent, 'foo');

      should(userRepository.load).calledWith('foo');
    });

    it('should return the anonymous user when its id is requested', async () => {
      for (const id of ['-1', 'anonymous']) {
        const user = await kuzzle.ask(getEvent, id);
        assertIsAnonymous(user);
        should(Repository.prototype.load).not.called();
      }
    });

    it('should invoke the parent load method', async () => {
      const fakeUser = new User();
      Repository.prototype.load.resolves(fakeUser);

      const user = await kuzzle.ask(getEvent, 'foo');

      should(user).eql(fakeUser);
      should(Repository.prototype.load).calledWith('foo');
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
    const deleteEvent = 'core:security:user:delete';
    let fakeUser;

    beforeEach(() => {
      sinon.stub(ApiKey, 'deleteByUser');
      sinon.stub(Repository.prototype, 'delete').resolves();

      fakeUser = new User();
      fakeUser._id = 'foo';
      sinon.stub(userRepository, 'load').resolves(fakeUser);
    });

    afterEach(() => {
      ApiKey.deleteByUser.restore();
      Repository.prototype.delete.restore();
    });

    it('should register a "delete" event', async () => {
      sinon.stub(userRepository, 'deleteById');

      await kuzzle.ask(deleteEvent, 'foo', 'bar');

      should(userRepository.deleteById).calledWith('foo', 'bar');
    });

    it('should load and delete the provided user', async () => {
      sinon.stub(userRepository, '_removeUserStrategies');

      await kuzzle.ask(deleteEvent, 'foo');

      should(userRepository.load).calledWith('foo');

      should(userRepository._removeUserStrategies).calledWith(fakeUser);
      should(ApiKey.deleteByUser).calledWithMatch(fakeUser, {refresh: 'false'});
      should(tokenRepositoryMock.deleteByKuid).calledWith('foo');
      should(Repository.prototype.delete).calledWithMatch(fakeUser, {
        refresh: 'false'
      });
    });

    it('should delete user credentials', async () => {
      const existsMethod = sinon.stub().resolves(true);
      const deleteMethod = sinon.stub().resolves();

      kuzzle.pluginsManager.listStrategies.returns(['someStrategy']);

      kuzzle.pluginsManager.getStrategyMethod
        .onFirstCall().returns(existsMethod)
        .onSecondCall().returns(deleteMethod);

      await kuzzle.ask(deleteEvent, 'foo');

      should(existsMethod)
        .calledOnce()
        .calledWithMatch(
          { input: { resource: { _id: 'foo' } } },
          'foo',
          'someStrategy');

      should(deleteMethod)
        .calledOnce()
        .calledWithMatch(
          { input: { resource: { _id: 'foo' } } },
          'foo',
          'someStrategy');
    });

    it('should forward refresh option', async () => {
      sinon.stub(userRepository, '_removeUserStrategies');

      await kuzzle.ask(deleteEvent, 'foo', {refresh: 'wait_for'});

      should(userRepository.load).calledWith('foo');

      should(userRepository._removeUserStrategies).calledWith(fakeUser);
      should(ApiKey.deleteByUser).calledWithMatch(fakeUser, {
        refresh: 'wait_for'
      });
      should(tokenRepositoryMock.deleteByKuid).calledWith('foo');
      should(Repository.prototype.delete).calledWithMatch(fakeUser, {
        refresh: 'wait_for'
      });
    });
  });

  describe('#mGet', () => {
    it('should register a mGet event and forward it to the parent class', async () => {
      sinon.stub(Repository.prototype, 'loadMultiFromDatabase').resolves();

      try {
        await kuzzle.ask('core:security:user:mGet', 'foo');

        should(Repository.prototype.loadMultiFromDatabase).calledWith('foo');
      }
      finally {
        Repository.prototype.loadMultiFromDatabase.restore();
      }
    });
  });

  describe('#create', () => {
    const createEvent = 'core:security:user:create';
    let fakeUser;

    beforeEach(() => {
      sinon.stub(userRepository, 'persist').resolves();
      sinon.stub(userRepository, 'fromDTO').resolves(fakeUser);
    });

    it('should register a "create" event', async () => {
      sinon.stub(userRepository, 'create');

      await kuzzle.ask(createEvent, 'id', 'profiles', 'content', 'opts');

      should(userRepository.create)
        .calledWith('id', 'profiles', 'content', 'opts');
    });

    it('should pass handle default options', async () => {
      const content = {
        _id: 'nope',
        _kuzzle_info: 'nope',
        foo: 'foo',
        profileIds: ['nope'],
      };
      const profiles = ['foo', 'bar'];

      await kuzzle.ask(createEvent, 'id', profiles, content, {userId: 'userId'});

      should(userRepository.fromDTO).calledWithMatch({
        foo: 'foo',
        profileIds: ['foo', 'bar'],
        _id: 'id',
        _kuzzle_info: {
          author: 'userId',
          updatedAt: null,
          updater: null,
        },
      });

      should(userRepository.fromDTO.firstCall.args[0]._kuzzle_info.createdAt)
        .approximately(Date.now(), 1000);

      should(userRepository.persist).calledWith(fakeUser, {
        database: {
          method: 'create',
          refresh: 'false',
        }
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
