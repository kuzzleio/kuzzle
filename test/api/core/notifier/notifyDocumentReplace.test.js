const
  should = require('should'),
  sinon = require('sinon'),
  { Request } = require('kuzzle-common-objects'),
  Kuzzle = require('../../../mocks/kuzzle.mock'),
  Notifier = require('../../../../lib/api/core/notifier');

describe('Test: notifier.notifyDocumentReplace', () => {
  let
    kuzzle,
    request,
    notifier;

  beforeEach(() => {
    kuzzle = new Kuzzle();
    notifier = new Notifier(kuzzle);

    sinon.stub(notifier, 'notifyDocument').resolves();

    request = new Request({
      controller: 'write',
      action: 'replace',
      requestId: 'foo',
      collection: 'bar',
      _id: 'Sir Isaac Newton is the deadliest son-of-a-bitch in space',
      body: {
        foo: 'bar',
        _kuzzle_info: {
          'can I has': 'cheezburgers?'
        }
      }
    });
  });

  it('should notify subscribers when a replaced document entered their scope', () => {
    const internalCache = kuzzle.cacheEngine.internal;
    kuzzle.koncorde.test.returns(['foo']);

    internalCache.get.resolves(JSON.stringify(['foo', 'bar']));

    return notifier.notifyDocumentReplace(request)
      .then(() => {
        const {_id, index, collection} = request.input.resource;

        should(notifier.notifyDocument.callCount).be.eql(2);

        should(notifier.notifyDocument.getCall(0))
          .calledWith(
            ['foo'],
            request,
            'in',
            'replace',
            {
              _id,
              _source: {
                foo: 'bar',
                _kuzzle_info: {'can I has': 'cheezburgers?'}
              }
            });

        should(notifier.notifyDocument.getCall(1))
          .calledWith(['bar'], request, 'out', 'replace', { _id });

        should(internalCache.get.callCount).be.eql(1);
        internalCache.get.getCall(0)
          .should.be.calledWith(`{notif/${index}/${collection}}/${_id}`);

        should(internalCache.del).not.be.called();

        should(internalCache.setex)
          .calledOnce()
          .calledWith(
            `{notif/${index}/${collection}}/${_id}`,
            kuzzle.config.limits.subscriptionDocumentTTL,
            JSON.stringify(['foo']));
      });
  });
});
