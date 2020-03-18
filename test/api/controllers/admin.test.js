'use strict';

const
  rewire = require('rewire'),
  should = require('should'),
  sinon = require('sinon'),
  {
    Request,
    errors: { PreconditionError, NotFoundError }
  } = require('kuzzle-common-objects'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  AdminController = rewire('../../../lib/api/controllers/admin'),
  { NativeController } = require('../../../lib/api/controllers/base');

describe('AdminController', () => {
  let
    adminController,
    kuzzle,
    request;

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

  describe('#refreshIndexCache', () => {
    it('should call underlaying storageEngine method', async () => {
      await adminController.refreshIndexCache();

      should(kuzzle.storageEngine.populateIndexCache).be.calledOnce();
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
    it('should call janitor dump action', done => {
      request.input.action = 'dump';
      request.input.args.suffix = 'dump-me-master';

      adminController.dump(request)
        .then(() => {
          should(kuzzle.janitor.dump).be.calledOnce();
          should(kuzzle.janitor.dump.getCall(0).args[0]).be.eql('dump-me-master');

          done();
        })
        .catch(error => done(error));
    });
  });

  describe('#shutdown', () => {
    let
      originalKill;

    beforeEach(() => {
      originalKill = process.kill;
      Object.defineProperty(process, 'kill', {
        value: sinon.stub()
      });

      request.input.action = 'shutdown';
    });

    afterEach(() => {
      Object.defineProperty(process, 'kill', {
        value: originalKill
      });
      AdminController.__set__('_locks', { shutdown: null });
    });

    it('should throw an error if shutdown is in progress', () => {
      AdminController.__set__('_locks', { shutdown: true });
      adminController = new AdminController(kuzzle);

      return should(() => {
        adminController.shutdown(request);
      }).throw(PreconditionError);
    });

    it('should send a SIGTERM', done => {
      adminController.shutdown(request);

      setTimeout(() => {
        should(process.kill).be.calledOnce();
        should(process.kill.getCall(0).args[0]).be.eql(process.pid);
        should(process.kill.getCall(0).args[1]).be.eql('SIGTERM');
        done();
      }, 50);
    });
  });

  describe('#loadMappings', () => {
    beforeEach(() => {
      request.input.action = 'loadMappings';
      request.input.body = { city: { seventeen: {} } };
    });

    it('should call Janitor.loadMappings', () => {
      return adminController.loadMappings(request)
        .then(() => {
          should(kuzzle.janitor.loadMappings)
            .be.calledOnce()
            .be.calledWith({ city: { seventeen: {} } });
        });
    });
  });

  describe('#loadFixtures', () => {
    beforeEach(() => {
      request.input.action = 'loadFixtures';
      request.input.body = { city: { seventeen: [] } };
    });

    it('should call Janitor.loadFixtures', () => {
      return adminController.loadFixtures(request)
        .then(() => {
          should(kuzzle.janitor.loadFixtures)
            .be.calledOnce()
            .be.calledWith({ city: { seventeen: [] } });
        });
    });

    it('should handle rejections if the janitor rejects when not waiting for a refresh', () => {
      const err = new Error('err');
      kuzzle.janitor.loadFixtures.rejects(err);
      request.input.args.refresh = null;

      return adminController.loadFixtures(request)
        .then(() => should(kuzzle.log.error).calledWith(err));
    });
  });

  describe('#loadSecurities', () => {
    beforeEach(() => {
      request.input.action = 'loadSecurities';
      request.input.body = { gordon: { freeman: [] } };
    });

    it('should call Janitor.loadSecurities', () => {
      return adminController.loadSecurities(request)
        .then(() => {
          should(kuzzle.janitor.loadSecurities)
            .be.calledOnce()
            .be.calledWith({ gordon: { freeman: [] } });
        });
    });
  });
});
