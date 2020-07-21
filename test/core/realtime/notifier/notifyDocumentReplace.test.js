'use strict';

const should = require('should');
const sinon = require('sinon');
const { Request } = require('kuzzle-common-objects');

const KuzzleMock = require('../../../mocks/kuzzle.mock');

const Notifier = require('../../../../lib/core/realtime/notifier');

describe('Test: notifier.notifyDocumentReplace', () => {
  let kuzzle;
  let request;
  let notifier;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    notifier = new Notifier(kuzzle);

    sinon.stub(notifier, 'notifyDocument').resolves();

    request = new Request({
      index: 'index',
      collection: 'collection',
      _id: 'Sir Isaac Newton is the deadliest son-of-a-bitch in space',
      body: {
        foo: 'bar',
        _kuzzle_info: {
          'can I has': 'cheezburgers?'
        }
      }
    });

    return notifier.init();
  });

  it('should register a "notify:replaced" event', async () => {
    sinon.stub(notifier, 'notifyDocumentReplace');

    kuzzle.ask.restore();
    await kuzzle.ask('core:realtime:notify:replaced', 'request');

    should(notifier.notifyDocumentReplace).calledWith('request');
  });

  it('should notify subscribers when a replaced document entered their scope', async () => {
    const internalCache = kuzzle.cacheEngine.internal;
    kuzzle.koncorde.test.returns(['foo']);

    internalCache.get.resolves(JSON.stringify(['foo', 'bar']));

    await notifier.notifyDocumentReplace(request);

    const { _id, index, collection } = request.input.resource;

    should(notifier.notifyDocument.callCount).be.eql(2);

    should(notifier.notifyDocument.getCall(0))
      .calledWith(['foo'], request, 'in', 'replace', {
        _id,
        _source: {
          foo: 'bar',
          _kuzzle_info: {'can I has': 'cheezburgers?'}
        },
      });

    should(notifier.notifyDocument.getCall(1))
      .calledWith(['bar'], request, 'out', 'replace', { _id });

    should(internalCache.get.callCount).be.eql(1);
    should(internalCache.get.getCall(0))
      .calledWith(`{notif/${index}/${collection}}/${_id}`);

    should(internalCache.del).not.be.called();

    should(internalCache.setex)
      .calledOnce()
      .calledWith(
        `{notif/${index}/${collection}}/${_id}`,
        kuzzle.config.limits.subscriptionDocumentTTL,
        JSON.stringify(['foo']));
  });

  it('should remove the cache entry if no room matches the replaced document', async () => {
    kuzzle.koncorde.test.returns([]);

    kuzzle.cacheEngine.internal.get.resolves(JSON.stringify(['foo', 'bar']));

    await notifier.notifyDocumentReplace(request);


    should(kuzzle.cacheEngine.internal.del)
      .calledWith(`{notif/index/collection}/${request.input.resource._id}`);

    should(kuzzle.cacheEngine.internal.setex).not.called();
  });
});
