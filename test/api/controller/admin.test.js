'use strict';

const rewire = require('rewire');
const should = require('should');
const sinon = require('sinon');
const {
  Request,
  errors: { PreconditionError, NotFoundError }
} = require('kuzzle-common-objects');
const KuzzleMock = require('../../mocks/kuzzle.mock');
const AdminController = rewire('../../../lib/api/controller/admin');
const { NativeController } = require('../../../lib/api/controller/base');

describe('AdminController', () => {
  let adminController;
  let kuzzle;
  let request;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    adminController = new AdminController(kuzzle);

    request = new Request({ controller: 'admin' });

    request.input.args.refresh = 'wait_for';
  });

  describe('#constructor', () => {
    it('should inherit the base constructor', () => {
      should(adminController).instanceOf(NativeController);
    });
  });

  describe('#resetCache', () => {
    let flushdbStub = sinon.stub();

    beforeEach(() => {
      request.input.action = 'resetCache';
    });

    it('should flush the cache for the specified database', done => {
      kuzzle.cacheEngine.public.flushdb = flushdbStub.returns();
      request.input.args.database = 'memoryStorage';

      adminController.resetCache(request)
        .then(() => {
          should(flushdbStub).be.calledOnce();
          done();
        })
        .catch(error => done(error));
    });

    it('should raise an error if database does not exist', () => {
      request.input.args.database = 'city17';

      should(() => adminController.resetCache(request)).throw(
        NotFoundError,
        { id: 'services.cache.database_not_found' });
    });
  });

  describe('#resetSecurity', () => {
    beforeEach(() => {
      request.input.action = 'resetSecurity';
      kuzzle.internalIndex.bootstrap.createInitialSecurities.resolves({
        profileIds: ['anonymous', 'default', 'admin'],
        roleIds: ['anonymous', 'default', 'admin']
      });
    });

    it('should scroll and delete all registered users, profiles and roles', async () => {
      await adminController.resetSecurity(request);

      should(kuzzle.repositories.user.truncate).be.calledOnce();
      should(kuzzle.repositories.profile.truncate).be.calledOnce();
      should(kuzzle.repositories.role.truncate).be.calledOnce();
      should(kuzzle.internalIndex.bootstrap.createInitialSecurities)
        .be.calledOnce();
      should(kuzzle.repositories.profile.loadProfiles)
        .be.calledWith(['anonymous', 'default', 'admin'], { resetCache: true });
      should(kuzzle.repositories.role.loadRoles)
        .be.calledWith(['anonymous', 'default', 'admin'], { resetCache: true });

      sinon.assert.callOrder(
        kuzzle.repositories.user.truncate,
        kuzzle.repositories.profile.truncate,
        kuzzle.repositories.role.truncate,
        kuzzle.internalIndex.bootstrap.createInitialSecurities,
        kuzzle.repositories.profile.loadProfiles,
        kuzzle.repositories.role.loadRoles,
      );
    });

    it('should unlock the action even if the promise reject', done => {
      request.input.args.refresh = 'wait_for';
      kuzzle.repositories.user.truncate.rejects();

      adminController.resetSecurity(request)
        .then(() => {
          done(new Error('Should reject'));
        })
        .catch(error => {
          should(error).be.instanceOf(Error);

          kuzzle.repositories.user.truncate.resolves();
          return adminController.resetSecurity(request);
        })
        .then(() => done())
        .catch(error => done(error));

    });
  });

  describe('#resetDatabase', () => {
    beforeEach(() => {
      request.input.action = 'resetDatabase';
    });

    it('remove all indexes handled by Kuzzle', async () => {
      adminController.publicStorage.listIndexes.resolves(['a', 'b', 'c']);

      const response = await adminController.resetDatabase(request);

      should(adminController.publicStorage.listIndexes).be.calledOnce();
      should(adminController.publicStorage.deleteIndexes)
        .be.calledWith(['a', 'b', 'c']);

      should(response).match({ acknowledge: true });
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

    afterEach(() => {
      AdminController.__set__('_locks', { shutdown: null });
    });

    it('should throw an error if shutdown is in progress', async () => {
      AdminController.__set__('_locks', { shutdown: true });
      adminController = new AdminController(kuzzle);

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

      should(kuzzle.storageEngine.public.loadMappings)
        .be.calledOnce()
        .be.calledWith({ city: { seventeen: {} } });
    });
  });

  describe('#loadFixtures', () => {
    beforeEach(() => {
      request.input.action = 'loadFixtures';
      request.input.body = { city: { seventeen: [] } };
    });

    it('should call loadFixtures from the public storage engine', async () => {
      await adminController.loadFixtures(request);

      should(kuzzle.storageEngine.public.loadFixtures)
        .be.calledOnce()
        .be.calledWith({ city: { seventeen: [] } });
    });

    it('should handle promise rejections when not waiting for a refresh', async () => {
      const err = new Error('err');
      kuzzle.storageEngine.public.loadFixtures.rejects(err);
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

      should(kuzzle.repositories.loadSecurities)
        .be.calledOnce()
        .be.calledWith(
          { gordon: { freeman: [] } },
          { onExistingUsers: 'overwrite', user: null, force: false });
    });
  });
});
