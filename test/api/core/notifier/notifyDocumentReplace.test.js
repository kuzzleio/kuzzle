const
  should = require('should'),
  sinon = require('sinon'),
  Bluebird = require('bluebird'),
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

    internalCache.search
      .onFirstCall().returns(Bluebird.resolve(['foo']))
      .onSecondCall().returns(Bluebird.resolve(['foo', 'bar']));

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

        should(internalCache.search.callCount).be.eql(2);
        should(internalCache.search.getCall(0)).calledWith(
          `notif/${request.input.resource.index}/${request.input.resource.collection}/${request.id}`
        );

        should(internalCache.search.getCall(1)).calledWith(
          `notif/${request.input.resource.index}/${request.input.resource.collection}/${request.input.resource._id}`
        );

        should(internalCache.remove).calledOnce();
        should(internalCache.remove).calledWith(
          `notif/${request.input.resource.index}/${request.input.resource.collection}/${request.input.resource._id}`, 
          ['bar']
        );

        should(internalCache.add).calledOnce();
        should(internalCache.add).calledWith(
          `notif/${request.input.resource.index}/${request.input.resource.collection}/${request.input.resource._id}`, 
          ['foo']
        );
      });
  });
});
