'use strict';

const should = require('should');
const sinon = require('sinon');
const { Request } = require('kuzzle-common-objects');

const KuzzleMock = require('../../../mocks/kuzzle.mock');

const Notifier = require('../../../../lib/core/realtime/notifier');

describe('Test: notifier.notifyDocumentUpdate', () => {
  let kuzzle;
  let notifier;
  let request;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    notifier = new Notifier(kuzzle);

    request = new Request({
      controller: 'document',
      action: 'update',
      index: 'foo',
      collection: 'bar',
      _id: 'Sir Isaac Newton is the deadliest son-of-a-bitch in space',
      body: {
        _kuzzle_info: {
          'canIhas': 'cheezburgers?'
        },
        foo: 'bar'
      }
    });

    sinon.stub(notifier, 'notifyDocument').resolves();

    return notifier.init();
  });

  it('should register a "notify:updated" event', async () => {
    sinon.stub(notifier, 'notifyDocumentUpdate');

    kuzzle.ask.restore();
    await kuzzle.ask('core:realtime:notify:updated', 'request', 'id', 'content');

    should(notifier.notifyDocumentUpdate).calledWith('request', 'id', 'content');
  });

  it('should notify subscribers when an updated document entered their scope', async () => {
    const {_id, index, collection} = request.input.resource;

    kuzzle.koncorde.test.returns(['foo']);
    kuzzle.storageEngine.public.get.resolves({
      _id,
      _source: {foo: 'bar'}
    });

    kuzzle.cacheEngine.internal.get.resolves(JSON.stringify(['foo', 'bar']));

    await notifier.notifyDocumentUpdate(request, _id, { foo: 'bar' });

    should(kuzzle.koncorde.test)
      .calledOnce()
      .calledWith('foo', 'bar', {foo: 'bar'}, _id);

    should(notifier.notifyDocument.callCount).be.eql(2);
    should(notifier.notifyDocument.getCall(0))
      .calledWith(['foo'], request, 'in', 'update', {
        _id,
        _source: { foo: 'bar' },
        _updatedFields: ['foo'],
      });

    should(notifier.notifyDocument.getCall(1))
      .calledWith(['bar'], request, 'out', 'update', { _id });

    should(kuzzle.cacheEngine.internal.get)
      .calledOnce()
      .calledWith(`{notif/${index}/${collection}}/${_id}`);

    should(kuzzle.cacheEngine.internal.del).not.be.called();

    should(kuzzle.cacheEngine.internal.setex)
      .calledOnce()
      .calledWith(
        `{notif/${index}/${collection}}/${_id}`,
        kuzzle.config.limits.subscriptionDocumentTTL,
        JSON.stringify(['foo']));
  });

  context('with a subscriptionDocumentTTL set to 0', () => {
    it('should set internalCache with no TTL', async () => {
      const {_id, index, collection} = request.input.resource;

      kuzzle.config.limits.subscriptionDocumentTTL = 0;

      kuzzle.koncorde.test.returns(['foo']);
      kuzzle.storageEngine.public.get.resolves({
        _id,
        _source: {foo: 'bar'},
      });

      kuzzle.cacheEngine.internal.get.resolves(JSON.stringify(['foo', 'bar']));

      await notifier.notifyDocumentUpdate(request, _id, { foo: 'bar' });

      should(kuzzle.cacheEngine.internal.setex).not.be.called();

      should(kuzzle.cacheEngine.internal.set)
        .calledOnce()
        .calledWith(
          `{notif/${index}/${collection}}/${_id}`,
          JSON.stringify(['foo']));
    });
  });

  it('should remove the cache entry if no room matches the updated document', async () => {
    const {_id, index, collection} = request.input.resource;

    kuzzle.koncorde.test.returns([]);
    kuzzle.storageEngine.public.get.resolves({
      _id,
      _source: {foo: 'bar'},
    });

    kuzzle.cacheEngine.internal.get.resolves(JSON.stringify(['foo', 'bar']));

    await notifier.notifyDocumentUpdate(request, _id, { foo: 'bar' });

    should(kuzzle.cacheEngine.internal.setex).not.be.called();

    should(kuzzle.cacheEngine.internal.del)
      .calledOnce()
      .calledWith(`{notif/${index}/${collection}}/${_id}`);
  });
});
