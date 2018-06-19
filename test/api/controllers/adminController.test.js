const
  rewire = require('rewire'),
  should = require('should'),
  sinon = require('sinon'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  Request = require('kuzzle-common-objects').Request,
  AdminController = rewire('../../../lib/api/controllers/adminController');

describe('Test: admin controller', () => {
  let
    adminController,
    kuzzle,
    request;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    adminController = new AdminController(kuzzle);
    request = new Request({ controller: 'admin' });
  });

  describe('#resetCache', () => {
    let flushdbStub = sinon.stub();

    beforeEach(() => {
      request.action = 'resetCache';
    });

    it('should flush the cache for the specified database', done => {
      kuzzle.services.list.memoryStorage.flushdb = flushdbStub.returns();
      request.input.args.database = 'memoryStorage';

      adminController.resetCache(request)
        .then(() => {
          should(flushdbStub).be.calledOnce();
          done();
        })
        .catch(error => done(error));
    });

    it('should raise an error if database does not exist', done => {
      request.input.args.database = 'city17';

      try {
        adminController.resetCache(request);
        done(new Error('Should not resolves'));
      } catch (e) {
        should(e).be.instanceOf(BadRequestError);
        done();
      }
    });
  });

  describe('#resetKuzzleData', () => {
    beforeEach(() => {
      request.action = 'resetKuzzleData';
    });

    it('should erase the internal ES & Redis dbs', done => {
      adminController.resetKuzzleData(request);

      setTimeout(() => {
        should(kuzzle.repositories.user.truncate).be.calledOnce();
        should(kuzzle.internalEngine.deleteIndex).be.calledOnce();
        should(kuzzle.services.list.internalCache.flushdb).be.calledOnce();

        should(kuzzle.indexCache.remove)
          .be.calledOnce()
          .be.calledWithExactly('internalIndex');

        should(kuzzle.internalEngine.bootstrap.all).be.calledOnce();
        should(kuzzle.validation).be.an.Object();
        should(kuzzle.start).be.a.Function();

        sinon.assert.callOrder(
          kuzzle.internalEngine.deleteIndex,
          kuzzle.services.list.internalCache.flushdb,
          kuzzle.indexCache.remove,
          kuzzle.internalEngine.bootstrap.all
        );
        done();
      }, 50);
    });
  });

  describe('#resetSecurity', () => {
    beforeEach(() => {
      request.action = 'resetKuzzleData';
    });

    it('should scroll and delete all registered users, profiles and roles', done => {
      adminController.resetSecurity(request);

      setTimeout(() => {
        should(kuzzle.repositories.user.truncate).be.calledOnce();
        should(kuzzle.repositories.profile.truncate).be.calledOnce();
        should(kuzzle.repositories.role.truncate).be.calledOnce();
        should(kuzzle.internalEngine.bootstrap.createDefaultProfiles).be.calledOnce();
        should(kuzzle.internalEngine.bootstrap.createDefaultRoles).be.calledOnce();

        sinon.assert.callOrder(
          kuzzle.repositories.user.truncate,
          kuzzle.repositories.profile.truncate,
          kuzzle.repositories.role.truncate,
          kuzzle.internalEngine.bootstrap.createDefaultProfiles,
          kuzzle.internalEngine.bootstrap.createDefaultRoles
        );
        done();
      }, 50);
    });
  });

  describe('#resetDatabase', () => {
    beforeEach(() => {
      request.action = 'resetDatabase';
    });

    it('remove all indexes handled by Kuzzle', done => {
      const deleteIndex = kuzzle.services.list.storageEngine.deleteIndex;
      kuzzle.indexCache.indexes = { halflife3: [], borealis: [], confirmed: [], '%kuzzle': [] };

      adminController.resetDatabase(request);

      setTimeout(() => {
        should(deleteIndex.callCount).be.eql(3);
        should(deleteIndex.getCall(0).args[0].input.resource.index).be.eql('halflife3');
        should(deleteIndex.getCall(1).args[0].input.resource.index).be.eql('borealis');
        should(deleteIndex.getCall(2).args[0].input.resource.index).be.eql('confirmed');
        should(kuzzle.indexCache.indexes).be.eql({ '%kuzzle': [] });

        done();
      }, 50);
    });
  });

  describe('#dump', () => {
    it('should call janitor dump action', done => {
      request.action = 'dump';
      request.input.args.suffix = 'dump-me-master';
      adminController.dump(request);

      setTimeout(() => {
        should(kuzzle.janitor.dump).be.calledOnce();
        should(kuzzle.janitor.dump.getCall(0).args[0]).be.eql('dump-me-master');
        done();
      }, 50);
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

      request.action = 'dump';
    });

    afterEach(() => {
      Object.defineProperty(process, 'kill', {
        value: originalKill
      });
      AdminController.__set__('_shutdown', false);
    });

    it('should throw an error if shutdown is in progress', () => {
      AdminController.__set__('_shutdown', true);
      adminController = new AdminController(kuzzle);

      return should(() => {
        adminController.shutdown(request);
      }).throw(BadRequestError);
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

});
