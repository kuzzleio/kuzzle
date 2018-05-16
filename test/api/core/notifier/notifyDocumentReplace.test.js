const
  should = require('should'),
  sinon = require('sinon'),
  Request = require('kuzzle-common-objects').Request,
  Kuzzle = require('../../../mocks/kuzzle.mock'),
  Notifier = require.main.require('lib/api/core/notifier');

describe('Test: notifier.notifyDocumentReplace', () => {
  let
    kuzzle,
    request,
    notifier;

  beforeEach(() => {
    kuzzle = new Kuzzle();
    notifier = new Notifier(kuzzle);
    notifier.notifyDocument = sinon.stub();

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
    const internalCache = kuzzle.services.list.internalCache;

    internalCache.get
      .onFirstCall().resolves(JSON.stringify(['foo']))
      .onSecondCall().resolves(JSON.stringify(['foo', 'bar']));

    return notifier.notifyDocumentReplace(request)
      .then(() => {
        should(notifier.notifyDocument.callCount).be.eql(2);

        should(notifier.notifyDocument.getCall(0))
          .calledWith(['foo'], request, 'in', 'done', 'replace', {
            _meta: {'can I has': 'cheezburgers?'},
            _id: request.input.resource._id,
            _source: {foo: 'bar'}
          });

        should(notifier.notifyDocument.getCall(1))
          .calledWith(['bar'], request, 'out', 'done', 'replace', {
            _id: request.input.resource._id
          });

        should(internalCache.get.callCount).be.eql(2);
        should(internalCache.get.getCall(0)).calledWith(
          `{notif/${request.input.resource.index}/${request.input.resource.collection}}/${request.id}`
        );

        should(internalCache.get.getCall(1)).calledWith(
          `{notif/${request.input.resource.index}/${request.input.resource.collection}}/${request.input.resource._id}`
        );

        should(internalCache.del).not.be.called();

        should(internalCache.setex)
          .calledOnce()
          .calledWith(
            `{notif/${request.input.resource.index}/${request.input.resource.collection}}/${request.input.resource._id}`,
            kuzzle.config.limits.subscriptionDocumentTTL,
            JSON.stringify(['foo']));
      });
  });
});
