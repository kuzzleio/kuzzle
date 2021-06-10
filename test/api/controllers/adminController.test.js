'use strict';

const should = require('should');
const sinon = require('sinon');
const mockRequire = require('mock-require');
const {
  Request,
  PreconditionError,
  NotFoundError
} = require('../../../index');

const KuzzleMock = require('../../mocks/kuzzle.mock');
const MutexMock = require('../../mocks/mutex.mock.js');

const NativeController = require('../../../lib/api/controllers/base/nativeController');

describe('AdminController', () => {
  let AdminController;
  let adminController;
  let kuzzle;
  let request;

  before(() => {
    mockRequire('../../../lib/util/mutex', { Mutex: MutexMock });
    AdminController = mockRequire.reRequire('../../../lib/api/controllers/adminController');
  });

  after(() => {
    mockRequire.stopAll();
  });

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    adminController = new AdminController();

    request = new Request({ controller: 'admin' });

    request.input.args.refresh = 'wait_for';
  });

  describe('#constructor', () => {
    it('should inherit the base constructor', () => {
      should(adminController).instanceOf(NativeController);
    });
  });

  describe('#resetCache', () => {
    beforeEach(() => {
      request.input.action = 'resetCache';
    });

    it('should flush the cache for the public database', async () => {
      request.input.args.database = 'memoryStorage';

      await adminController.resetCache(request);

      should(kuzzle.ask).be.calledWith('core:cache:public:flushdb');
    });

    it('should flush the cache for the internal database', async () => {
      request.input.args.database = 'internalCache';

      await adminController.resetCache(request);

      should(kuzzle.ask).be.calledWith('core:cache:internal:flushdb');
    });

    it('should raise an error if database does not exist', () => {
      request.input.args.database = 'city17';

      return should(adminController.resetCache(request)).rejectedWith(
        NotFoundError,
        { id: 'services.cache.database_not_found' });
    });
  });

  describe('#resetSecurity', () => {
    beforeEach(() => {
      request.input.action = 'resetSecurity';
      kuzzle.internalIndex.createInitialSecurities.resolves({
        profileIds: ['anonymous', 'default', 'admin'],
        roleIds: ['anonymous', 'default', 'admin']
      });
    });

    it('should scroll and delete all registered users, profiles and roles', async () => {
      await adminController.resetSecurity(request);

      const userSpy = kuzzle.ask.withArgs('core:security:user:truncate');
      const profileSpy = kuzzle.ask.withArgs('core:security:profile:truncate');
      const roleSpy = kuzzle.ask.withArgs('core:security:role:truncate');
      should(kuzzle.internalIndex.createInitialSecurities)
        .be.calledOnce();

      sinon.assert.callOrder(
        userSpy,
        profileSpy,
        roleSpy,
        kuzzle.internalIndex.createInitialSecurities);

      const mutex = MutexMock.__getLastMutex();

      should(mutex.resource).eql('resetSecurity');
      should(mutex.timeout).eql(0);
      should(mutex.lock).calledOnce();
      should(mutex.unlock).calledOnce();
    });

    it('should unlock the action even if the promise rejects', async () => {
      request.input.args.refresh = 'wait_for';
      kuzzle.ask.withArgs('core:security:user:truncate').rejects();

      await should(adminController.resetSecurity(request)).be.rejected();

      const mutex1 = MutexMock.__getLastMutex();

      should(mutex1.resource).eql('resetSecurity');
      should(mutex1.timeout).eql(0);
      should(mutex1.lock).calledOnce();
      should(mutex1.unlock).calledOnce();

      kuzzle.ask.withArgs('core:security:user:truncate').resolves();

      await should(adminController.resetSecurity(request)).fulfilled();

      const mutex2 = MutexMock.__getLastMutex();

      should(mutex2.resource).eql('resetSecurity');
      should(mutex2.timeout).eql(0);
      should(mutex2.lock).calledOnce();
      should(mutex2.unlock).calledOnce();
      should(mutex2).not.eql(mutex1);
    });

    it('should reject if a security reset is already underway', async () => {
      MutexMock.__canLock(false);

      try {
        await should(adminController.resetSecurity(request))
          .rejectedWith(PreconditionError, { id: 'api.process.action_locked' });
        should(MutexMock.__getLastMutex().resource).eql('resetSecurity');
      }
      finally {
        MutexMock.__canLock(true);
      }
    });
  });

  describe('#resetDatabase', () => {
    beforeEach(() => {
      request.input.action = 'resetDatabase';
    });

    it('remove all indexes handled by Kuzzle', async () => {
      kuzzle.ask
        .withArgs('core:storage:public:index:list')
        .resolves(['a', 'b', 'c']);

      const response = await adminController.resetDatabase(request);

      should(kuzzle.ask).be.calledWith('core:storage:public:index:list');
      should(kuzzle.ask).be.calledWith(
        'core:storage:public:index:mDelete',
        ['a', 'b', 'c']);

      should(response).match({ acknowledge: true });

      const mutex = MutexMock.__getLastMutex();

      should(mutex.resource).eql('resetDatabase');
      should(mutex.timeout).eql(0);
      should(mutex.lock).calledOnce();
      should(mutex.unlock).calledOnce();
    });

    it('should reject if a database reset is already underway', async () => {
      MutexMock.__canLock(false);

      try {
        await should(adminController.resetDatabase(request))
          .rejectedWith(PreconditionError, { id: 'api.process.action_locked' });
        should(MutexMock.__getLastMutex().resource).eql('resetDatabase');
      }
      finally {
        MutexMock.__canLock(true);
      }
    });
  });

  describe('#dump', () => {
    it('should call kuzzle dump action', async () => {
      request.input.action = 'dump';
      request.input.args.suffix = 'dump-me-master';

      await adminController.dump(request);

      should(kuzzle.dump).be.calledOnce();
      should(kuzzle.dump.getCall(0).args[0]).be.eql('dump-me-master');
    });
  });

  describe('#shutdown', () => {
    beforeEach(() => {
      request.input.action = 'shutdown';
    });

    it('should throw an error if shutdown is in progress', async () => {
      adminController = new AdminController();
      adminController.shuttingDown = true;

      await should(adminController.shutdown(request))
        .rejectedWith(PreconditionError, { id: 'api.process.action_locked' });
    });

    it('should send invoke kuzzle.shutdown', async () => {
      await adminController.shutdown(request);

      should(kuzzle.shutdown).be.calledOnce();
    });
  });

  describe('#loadMappings', () => {
    beforeEach(() => {
      request.input.action = 'loadMappings';
      request.input.body = { city: { seventeen: {} } };
    });

    it('should call loadMappings from the public storage engine', async () => {
      await adminController.loadMappings(request);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:mappings:import',
        request.input.body);
    });
  });

  describe('#loadFixtures', () => {
    beforeEach(() => {
      request.input.action = 'loadFixtures';
      request.input.body = { city: { seventeen: [] } };
    });

    it('should call loadFixtures from the public storage engine', async () => {
      await adminController.loadFixtures(request);

      should(kuzzle.ask).be.calledWith(
        'core:storage:public:document:import',
        request.input.body);
    });

    it('should handle promise rejections when not waiting for a refresh', async () => {
      const err = new Error('err');

      kuzzle.ask
        .withArgs('core:storage:public:document:import')
        .rejects(err);

      request.input.args.refresh = false;

      await should(adminController.loadFixtures(request)).fulfilled();

      should(kuzzle.log.error).calledWith(err);
    });
  });

  describe('#loadSecurities', () => {
    beforeEach(() => {
      request.input.action = 'loadSecurities';
      request.input.args.onExistingUsers = 'overwrite';
      request.input.body = { gordon: { freeman: [] } };
    });

    it('should call loadSecurities from the secutiry module', async () => {
      await adminController.loadSecurities(request);

      should(kuzzle.ask)
        .be.calledOnce()
        .be.calledWith(
          'core:security:load',
          { gordon: { freeman: [] } },
          { onExistingUsers: 'overwrite', user: null, force: false });
    });
  });
});
