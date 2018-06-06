const
  rewire = require('rewire'),
  should = require('should'),
  sinon = require('sinon'),
  Bluebird = require('bluebird'),
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
      kuzzle.services.list.memoryStorage.flushdb = flushdbStub.yields();
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

    it('should erase the internal ES & Redis dbs', () => {
      kuzzle.repositories.user.search.returns(Bluebird.resolve({total: 0, hits: []}));

      return adminController.resetKuzzleData(request)
        .then(() => {
          should(kuzzle.repositories.user.search).be.calledOnce();
          should(kuzzle.repositories.user.scroll).not.be.called();
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
        });
    });

    it('should scroll and delete all registered users', () => {
      kuzzle.repositories.user.search.returns(Bluebird.resolve({total: 5, scrollId: 'foobar', hits: [
        {_id: 'foo1' },
        {_id: 'foo2' },
        {_id: 'foo3' }
      ]}));

      kuzzle.repositories.user.scroll.onFirstCall().returns(Bluebird.resolve({
        total: 1,
        scrollId: 'foobar2',
        hits: [{_id: 'foo4'}]
      }));

      kuzzle.repositories.user.scroll.onSecondCall().returns(Bluebird.resolve({
        total: 1,
        scrollId: 'foobar2',
        hits: [{_id: 'foo5'}]
      }));

      return adminController.resetKuzzleData(request)
        .then(() => {
          should(kuzzle.repositories.user.search).be.calledOnce();
          should(kuzzle.repositories.user.scroll).be.calledTwice();

          should(kuzzle.repositories.user.scroll.getCall(0).args[0]).be.eql('foobar');
          should(kuzzle.repositories.user.scroll.getCall(1).args[0]).be.eql('foobar2');

          should(kuzzle.funnel.controllers.security.deleteUser.callCount).be.eql(5);
          should(kuzzle.funnel.controllers.security.deleteUser.getCall(0).args[0].input.resource._id).be.eql('foo1');
          should(kuzzle.funnel.controllers.security.deleteUser.getCall(1).args[0].input.resource._id).be.eql('foo2');
          should(kuzzle.funnel.controllers.security.deleteUser.getCall(2).args[0].input.resource._id).be.eql('foo3');
          should(kuzzle.funnel.controllers.security.deleteUser.getCall(3).args[0].input.resource._id).be.eql('foo4');
          should(kuzzle.funnel.controllers.security.deleteUser.getCall(4).args[0].input.resource._id).be.eql('foo5');
        });
    });
  });

  describe('#resetKuzzleData', () => {
    beforeEach(() => {
      request.action = 'resetKuzzleData';
    });

    it('should scroll and delete all registered users, profiles and roles', () => {
      kuzzle.repositories.user.search.returns(Bluebird.resolve({total: 5, scrollId: 'foobarUser', hits: [
        {_id: 'user1' },
        {_id: 'user2' },
        {_id: 'user3' }
      ]}));
      kuzzle.repositories.user.scroll.onFirstCall().returns(Bluebird.resolve({
        total: 1,
        scrollId: 'foobarUser2',
        hits: [{_id: 'user4'}]
      }));
      kuzzle.repositories.user.scroll.onSecondCall().returns(Bluebird.resolve({
        total: 1,
        scrollId: 'foobarUser2',
        hits: [{_id: 'user5'}]
      }));

      kuzzle.repositories.profile.search.returns(Bluebird.resolve({total: 5, scrollId: 'foobarProfile', hits: [
        {_id: 'profile1' },
        {_id: 'profile2' },
        {_id: 'profile3' }
      ]}));
      kuzzle.repositories.profile.scroll.onFirstCall().returns(Bluebird.resolve({
        total: 1,
        scrollId: 'foobarProfile2',
        hits: [{_id: 'profile4'}]
      }));
      kuzzle.repositories.profile.scroll.onSecondCall().returns(Bluebird.resolve({
        total: 1,
        scrollId: 'foobarProfile2',
        hits: [{_id: 'profile5'}]
      }));

      kuzzle.repositories.role.search.returns(Bluebird.resolve({total: 5, scrollId: 'foobarRole', hits: [
        {_id: 'role1' },
        {_id: 'role2' },
        {_id: 'role3' }
      ]}));
      kuzzle.repositories.role.scroll.onFirstCall().returns(Bluebird.resolve({
        total: 1,
        scrollId: 'foobarRole2',
        hits: [{_id: 'role4'}]
      }));
      kuzzle.repositories.role.scroll.onSecondCall().returns(Bluebird.resolve({
        total: 1,
        scrollId: 'foobarRole2',
        hits: [{_id: 'role5'}]
      }));

      return adminController.resetSecurity(request)
        .then(() => {
          should(kuzzle.repositories.user.search).be.calledOnce();
          should(kuzzle.repositories.user.scroll).be.calledTwice();

          should(kuzzle.repositories.user.scroll.getCall(0).args[0]).be.eql('foobarUser');
          should(kuzzle.repositories.user.scroll.getCall(1).args[0]).be.eql('foobarUser2');

          should(kuzzle.funnel.controllers.security.deleteUser.callCount).be.eql(5);
          should(kuzzle.funnel.controllers.security.deleteUser.getCall(0).args[0].input.resource._id).be.eql('user1');
          should(kuzzle.funnel.controllers.security.deleteUser.getCall(0).args[0].input.args.refresh).be.eql('wait_for');
          should(kuzzle.funnel.controllers.security.deleteUser.getCall(1).args[0].input.resource._id).be.eql('user2');
          should(kuzzle.funnel.controllers.security.deleteUser.getCall(2).args[0].input.resource._id).be.eql('user3');
          should(kuzzle.funnel.controllers.security.deleteUser.getCall(3).args[0].input.resource._id).be.eql('user4');
          should(kuzzle.funnel.controllers.security.deleteUser.getCall(4).args[0].input.resource._id).be.eql('user5');


          should(kuzzle.repositories.profile.search).be.calledOnce();
          should(kuzzle.repositories.profile.scroll).be.calledTwice();

          should(kuzzle.repositories.profile.scroll.getCall(0).args[0]).be.eql('foobarProfile');
          should(kuzzle.repositories.profile.scroll.getCall(1).args[0]).be.eql('foobarProfile2');

          should(kuzzle.funnel.controllers.security.deleteProfile.callCount).be.eql(5);
          should(kuzzle.funnel.controllers.security.deleteProfile.getCall(0).args[0].input.resource._id).be.eql('profile1');
          should(kuzzle.funnel.controllers.security.deleteProfile.getCall(0).args[0].input.args.refresh).be.eql('wait_for');
          should(kuzzle.funnel.controllers.security.deleteProfile.getCall(1).args[0].input.resource._id).be.eql('profile2');
          should(kuzzle.funnel.controllers.security.deleteProfile.getCall(2).args[0].input.resource._id).be.eql('profile3');
          should(kuzzle.funnel.controllers.security.deleteProfile.getCall(3).args[0].input.resource._id).be.eql('profile4');
          should(kuzzle.funnel.controllers.security.deleteProfile.getCall(4).args[0].input.resource._id).be.eql('profile5');


          should(kuzzle.repositories.role.search).be.calledOnce();
          should(kuzzle.repositories.role.scroll).be.calledTwice();

          should(kuzzle.repositories.role.scroll.getCall(0).args[0]).be.eql('foobarRole');
          should(kuzzle.repositories.role.scroll.getCall(1).args[0]).be.eql('foobarRole2');

          should(kuzzle.funnel.controllers.security.deleteRole.callCount).be.eql(5);
          should(kuzzle.funnel.controllers.security.deleteRole.getCall(0).args[0].input.resource._id).be.eql('role1');
          should(kuzzle.funnel.controllers.security.deleteRole.getCall(0).args[0].input.args.refresh).be.eql('wait_for');
          should(kuzzle.funnel.controllers.security.deleteRole.getCall(1).args[0].input.resource._id).be.eql('role2');
          should(kuzzle.funnel.controllers.security.deleteRole.getCall(2).args[0].input.resource._id).be.eql('role3');
          should(kuzzle.funnel.controllers.security.deleteRole.getCall(3).args[0].input.resource._id).be.eql('role4');
          should(kuzzle.funnel.controllers.security.deleteRole.getCall(4).args[0].input.resource._id).be.eql('role5');
        });
    });
  });

  describe('#resetDatabase', () => {
    beforeEach(() => {
      request.action = 'resetDatabase';
    });

    it('remove all indexes handled by Kuzzle', () => {
      const deleteIndex = kuzzle.services.list.storageEngine.deleteIndex;
      kuzzle.indexCache.indexes = { halflife3: [], borealis: [], confirmed: [], '%kuzzle': [] };

      return adminController.resetDatabase(request)
        .then(() => {
          should(deleteIndex.callCount).be.eql(3);
          should(deleteIndex.getCall(0).args[0].input.resource.index).be.eql('halflife3');
          should(deleteIndex.getCall(1).args[0].input.resource.index).be.eql('borealis');
          should(deleteIndex.getCall(2).args[0].input.resource.index).be.eql('confirmed');
          should(kuzzle.indexCache.indexes).be.empty();
        });
    });
  });

});
