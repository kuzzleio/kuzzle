const
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  Bluebird = require('bluebird'),
  sinon = require('sinon'),
  should = require('should');

describe('Test: clean database', () => {
  let
    cleanDb,
    kuzzle;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    cleanDb = require('../../../../lib/api/controllers/cli/cleanDb')(kuzzle);
  });

  it('should erase the internal ES & Redis dbs', () => {
    kuzzle.repositories.user.search.returns(Bluebird.resolve({total: 0, hits: []}));

    return cleanDb(null, sinon.stub())
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

    return cleanDb(null, sinon.stub())
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
