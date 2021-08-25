'use strict';

const should = require('should');
const sinon = require('sinon');

const {
  BadRequestError,
  InternalError: KuzzleInternalError,
  NotFoundError,
  PreconditionError,
} = require('../../../index');
const KuzzleMock = require('../../mocks/kuzzle.mock');

const Repository = require('../../../lib/core/shared/repository');
const User = require('../../../lib/model/security/user');
const ApiKey = require('../../../lib/model/storage/apiKey');
const UserRepository = require('../../../lib/core/security/userRepository');

describe('Test: security/userRepository', () => {
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

    userRepository = new UserRepository({
      profile: profileRepositoryMock,
      token: tokenRepositoryMock,
    });

    return userRepository.init();
  });

  describe('#anonymous', () => {
    it('should return a valid anonymous user', async () => {
      const user = await kuzzle.ask('core:security:user:anonymous:get');
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

  describe('#adminExists', () => {
    const adminExistsEvent = 'core:security:user:admin:exist';

    it('should register an "adminExists" event', async () => {
      userRepository.adminExists = sinon.stub();

      await kuzzle.ask(adminExistsEvent);

      should(userRepository.adminExists).be.calledOnce();
    });

    it('should call search with right query', async () => {
      userRepository.search = sinon.stub().resolves({ total: 0 });

      const query = { term: { profileIds: 'admin' } };

      await userRepository.adminExists();

      should(userRepository.search)
        .be.calledWith({ query });
    });

    it('should return false if there is no result', async () => {
      userRepository.search = sinon.stub().resolves({ total: 0 });

      const exists = await userRepository.adminExists();

      should(exists).be.false();
    });

    it('should return true if there is result', async () => {
      userRepository.search = sinon.stub().resolves({ total: 42 });

      const exists = await userRepository.adminExists();

      should(exists).be.true();
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
      sinon.stub(userRepository, 'persist').resolves(fakeUser);
      sinon.stub(userRepository, 'fromDTO').resolves(fakeUser);
    });

    it('should register a "create" event', async () => {
      sinon.stub(userRepository, 'create');

      await kuzzle.ask(createEvent, 'id', 'profiles', 'content', 'opts');

      should(userRepository.create)
        .calledWith('id', 'profiles', 'content', 'opts');
    });

    it('should handle default options', async () => {
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

    it('should handle the refresh option', async () => {
      await kuzzle.ask(createEvent, 'id', [], {}, {
        refresh: 'wait_for',
        userId: 'userId',
      });

      should(userRepository.persist).calledWith(fakeUser, {
        database: {
          method: 'create',
          refresh: 'wait_for',
        }
      });
    });

    it('should return the created user object', async () => {
      const ret = await kuzzle.ask(createEvent, 'id', [], {}, {userId: 'userId'});

      should(ret).eql(fakeUser);
    });

    it('should replace generic failure exceptions with a security dedicated one', async () => {
      const error = new Error('foo');

      userRepository.persist.rejects(error);

      await should(kuzzle.ask(createEvent, 'id', [], {}, {}))
        .rejectedWith(error);

      error.id = 'services.storage.document_already_exists';

      await should(kuzzle.ask(createEvent, 'id', [], {}, {}))
        .rejectedWith(PreconditionError, { id: 'security.user.already_exists' });
    });
  });

  describe('#replace', () => {
    const replaceEvent = 'core:security:user:replace';
    let fakeUser;

    beforeEach(() => {
      fakeUser = new User();

      sinon.stub(userRepository, 'load').resolves();
      sinon.stub(userRepository, 'persist').resolves(fakeUser);
      sinon.stub(userRepository, 'fromDTO').resolves(fakeUser);
    });

    it('should register a "replace" event', async () => {
      sinon.stub(userRepository, 'replace');

      await kuzzle.ask(replaceEvent, 'id', 'profiles', 'content', 'opts');

      should(userRepository.replace).calledWith('id', 'profiles', 'content', 'opts');
    });

    it('should handle default options', async () => {
      const content = {
        _id: 'nope',
        _kuzzle_info: 'nope',
        foo: 'foo',
        profileIds: 'nope',
      };

      await kuzzle.ask(replaceEvent, 'id', ['foo', 'bar'], content, {
        userId: 'userId'
      });

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
          method: 'replace',
          refresh: 'false',
        }
      });
    });

    it('should handle the refresh option', async () => {
      await kuzzle.ask(replaceEvent, 'id', [], {}, {
        refresh: 'wait_for',
        userId: 'userId',
      });

      should(userRepository.persist).calledWith(fakeUser, {
        database: {
          method: 'replace',
          refresh: 'wait_for',
        }
      });
    });

    it('should return the created user object', async () => {
      const ret = await kuzzle.ask(replaceEvent, 'id', [], {}, {
        userId: 'userId'
      });

      should(ret).eql(fakeUser);
    });

    it('should throw if the user does not exist', async () => {
      const error = new Error('does not exist');
      userRepository.load.withArgs('id').rejects(error);

      await should(kuzzle.ask(replaceEvent, 'id', [], {}, {}))
        .rejectedWith(error);
    });
  });

  describe('#update', () => {
    const updateEvent = 'core:security:user:update';
    let fakeUser;

    beforeEach(() => {
      fakeUser = new User();
      fakeUser._id = 'foo';
      fakeUser.profileIds = ['foo', 'bar'];
      fakeUser._kuzzle_info = {
        createdAt: 'createdAt',
        updatedAt: 'foo',
        updater: 'bar',
        author: 'author'
      }

      sinon.stub(userRepository, 'load').resolves(fakeUser);
      sinon.stub(userRepository, 'persist').resolves(fakeUser);
      sinon.stub(userRepository, 'fromDTO').resolves(fakeUser);
    });

    it('should register a "update" event', async () => {
      sinon.stub(userRepository, 'update');

      await kuzzle.ask(updateEvent, 'id', 'profiles', 'content', 'opts');

      should(userRepository.update).calledWith('id', 'profiles', 'content', 'opts');
    });

    it('should handle default options', async () => {
      const content = {
        _id: 'nope',
        _kuzzle_info: 'nope',
        foo: 'foo',
        profileIds: 'nope',
      };

      await kuzzle.ask(updateEvent, 'id', ['baz', 'qux'], content);

      should(userRepository.fromDTO).calledWithMatch({
        foo: 'foo',
        profileIds: ['baz', 'qux'],
        _id: 'id',
        _kuzzle_info: {
          updater: undefined,
          createdAt: 'createdAt',
          author: 'author'
        },
      });

      should(userRepository.fromDTO.firstCall.args[0]._kuzzle_info.updatedAt)
        .approximately(Date.now(), 1000);

      should(userRepository.persist).calledWith(fakeUser, {
        database: {
          method: 'update',
          refresh: 'false',
          retryOnConflict: 10,
        }
      });
    });

    it('should keep the previous version profiles if not updated', async () => {
      const content = {
        _id: 'nope',
        _kuzzle_info: 'nope',
        foo: 'foo',
        profileIds: 'nope',
      };

      await kuzzle.ask(updateEvent, 'id', null, content, {
        userId: 'userId'
      });

      should(userRepository.fromDTO).calledWithMatch({
        foo: 'foo',
        profileIds: ['foo', 'bar'],
        _id: 'id',
        _kuzzle_info: {
          updater: 'userId',
          createdAt: 'createdAt',
          author: 'author'
        },
      });

      should(userRepository.fromDTO.firstCall.args[0]._kuzzle_info.updatedAt)
        .approximately(Date.now(), 1000);

      should(userRepository.persist).calledWith(fakeUser, {
        database: {
          method: 'update',
          refresh: 'false',
          retryOnConflict: 10,
        }
      });
    });

    it('should handle options', async () => {
      await kuzzle.ask(updateEvent, 'id', [], {}, {
        refresh: 'wait_for',
        retryOnConflict: 123,
        userId: 'userId',
      });

      should(userRepository.persist).calledWith(fakeUser, {
        database: {
          method: 'update',
          refresh: 'wait_for',
          retryOnConflict: 123,
        }
      });
    });

    it('should return the updated user object', async () => {
      const ret = await kuzzle.ask(updateEvent, 'id', [], {}, {
        userId: 'userId'
      });

      should(ret).eql(fakeUser);
    });

    it('should throw if the user does not exist', async () => {
      const error = new Error('does not exist');
      userRepository.load.withArgs('id').rejects(error);

      await should(kuzzle.ask(updateEvent, 'id', [], {}, {}))
        .rejectedWith(error);
    });
  });

  describe('#scroll', () => {
    it('should register a scroll event and forward it to the parent class', async () => {
      sinon.stub(Repository.prototype, 'scroll').resolves();

      try {
        await kuzzle.ask('core:security:user:scroll', 'foo', 'bar');

        should(Repository.prototype.scroll).calledWith('foo', 'bar');
      }
      finally {
        Repository.prototype.scroll.restore();
      }
    });
  });

  describe('#search', () => {
    it('should register a search event and forward it to the parent class', async () => {
      sinon.stub(Repository.prototype, 'search').resolves();

      try {
        await kuzzle.ask('core:security:user:search', 'foo', 'bar');

        should(Repository.prototype.search).calledWith('foo', 'bar');
      }
      finally {
        Repository.prototype.search.restore();
      }
    });
  });

  describe('#truncate', () => {
    it('should register a truncate event and forward it to the parent class', async () => {
      sinon.stub(Repository.prototype, 'truncate').resolves();

      try {
        await kuzzle.ask('core:security:user:truncate', 'foo');

        should(Repository.prototype.truncate).calledWith('foo');
      }
      finally {
        Repository.prototype.truncate.restore();
      }
    });
  });

  describe('#loadOneFromDatabase', () => {
    beforeEach(() => {
      sinon.stub(Repository.prototype, 'loadOneFromDatabase');
    });

    afterEach(() => {
      Repository.prototype.loadOneFromDatabase.restore();
    });

    it('should invoke its super function', async () => {
      Repository.prototype.loadOneFromDatabase.resolves('foo');

      await should(userRepository.loadOneFromDatabase('bar'))
        .fulfilledWith('foo');

      should(Repository.prototype.loadOneFromDatabase)
        .calledWith('bar');
    });

    it('should wrap generic 404s into profile dedicated errors', () => {
      const error = new Error('foo');
      error.status = 404;

      Repository.prototype.loadOneFromDatabase.rejects(error);

      return should(userRepository.loadOneFromDatabase('foo'))
        .rejectedWith(NotFoundError, { id: 'security.user.not_found' });
    });

    it('should re-throw non-404 errors as is', () => {
      const error = new Error('foo');

      Repository.prototype.loadOneFromDatabase.rejects(error);

      return should(userRepository.loadOneFromDatabase('foo'))
        .rejectedWith(error);
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
