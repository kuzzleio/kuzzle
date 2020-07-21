'use strict';

const should = require('should');
const sinon = require('sinon');
const { Request } = require('kuzzle-common-objects');

const KuzzleMock = require('../../../mocks/kuzzle.mock');

const Notifier = require('../../../../lib/core/realtime/notifier');

describe('Test: notifier.notifyDocumentMChanges', () => {
  const index = 'index';
  const collection = 'collection';
  const action = 'action';
  const request = new Request({ index, collection, action });
  let kuzzle;
  let notifier;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    notifier = new Notifier(kuzzle);

    sinon.stub(notifier, '_setCacheWithTTL');
    sinon.stub(notifier, 'notifyDocument');

    return notifier.init();
  });

  it('should register a "notify:mChanged" event', async () => {
    sinon.stub(notifier, 'notifyDocumentMChanges');

    kuzzle.ask.restore();
    await kuzzle.ask('core:realtime:notify:mChanged', 'req', 'docs', 'cached');

    should(notifier.notifyDocumentMChanges).calledWith('req', 'docs', 'cached');
  });

  it('should send as many "in" notifications as necessary', async () => {
    const doc1 = { _id: 'id1', _source: 'src1', created: true };
    const doc2 = { _id: 'id2', _source: 'src2' };

    kuzzle.koncorde.test
      .withArgs(index, collection, doc1._source, doc1._id)
      .returns(['foo', 'bar']);

    kuzzle.koncorde.test
      .withArgs(index, collection, doc2._source, doc2._id)
      .returns(['baz', 'qux']);

    await notifier.notifyDocumentMChanges(request, [doc1, doc2], false);

    should(kuzzle.cacheEngine.internal.mget).not.called();
    should(kuzzle.cacheEngine.internal.del).not.called();
    should(notifier.notifyDocument).calledTwice();

    should(notifier.notifyDocument)
      .calledWith(['foo', 'bar'], request, 'in', 'create', {
        _id: doc1._id,
        _source: doc1._source,
      });

    should(notifier.notifyDocument)
      .calledWith(['baz', 'qux'], request, 'in', action, {
        _id: doc2._id,
        _source: doc2._source,
      });

    should(notifier._setCacheWithTTL).calledWith(
      `{notif/${index}/${collection}}/${doc1._id}`,
      JSON.stringify(['foo', 'bar']));

    should(notifier._setCacheWithTTL).calledWith(
      `{notif/${index}/${collection}}/${doc2._id}`,
      JSON.stringify(['baz', 'qux']));
  });

  it('should send "out" notifications when documents exit previously entered rooms', async () => {
    const doc = { _id: 'id', _source: 'src' };
    const cacheId = `{notif/${index}/${collection}}/${doc._id}`;

    kuzzle.koncorde.test
      .withArgs(index, collection, doc._source, doc._id)
      .returns(['foo', 'bar']);

    kuzzle.cacheEngine.internal.mget.resolves([JSON.stringify(['bar', 'baz'])]);

    await notifier.notifyDocumentMChanges(request, [ doc ], true);

    should(kuzzle.cacheEngine.internal.mget)
      .calledOnce()
      .calledWith([cacheId]);

    should(kuzzle.cacheEngine.internal.del).not.called();
    should(notifier.notifyDocument).calledTwice();

    should(notifier.notifyDocument)
      .calledWith(['baz'], request, 'out', action, { _id: doc._id });

    should(notifier.notifyDocument)
      .calledWith(['foo', 'bar'], request, 'in', action, {
        _id: doc._id,
        _source: doc._source,
      });

    should(notifier._setCacheWithTTL)
      .calledWith(cacheId, JSON.stringify(['foo', 'bar']));
  });

  it('should remove the cache key if no more room matches the documents', async () => {
    const doc1 = { _id: 'id1', _source: 'src1', created: true };
    const doc2 = { _id: 'id2', _source: 'src2' };

    kuzzle.koncorde.test
      .withArgs(index, collection, doc1._source, doc1._id)
      .returns(['foo', 'bar']);

    kuzzle.koncorde.test
      .withArgs(index, collection, doc2._source, doc2._id)
      .returns([]);

    kuzzle.cacheEngine.internal.mget.resolves([
      JSON.stringify(['foo', 'bar']),
      JSON.stringify(['baz', 'qux']),
    ]);

    await notifier.notifyDocumentMChanges(request, [doc1, doc2], true);

    should(kuzzle.cacheEngine.internal.mget)
      .calledOnce()
      .calledWith([
        `{notif/${index}/${collection}}/${doc1._id}`,
        `{notif/${index}/${collection}}/${doc2._id}`
      ]);

    should(notifier.notifyDocument).calledTwice();

    should(notifier.notifyDocument)
      .calledWith(['foo', 'bar'], request, 'in', 'create', {
        _id: doc1._id,
        _source: doc1._source,
      });

    should(notifier.notifyDocument)
      .calledWith(['baz', 'qux'], request, 'out', action, { _id: doc2._id });

    should(notifier._setCacheWithTTL)
      .calledOnce()
      .calledWith(
        `{notif/${index}/${collection}}/${doc1._id}`,
        JSON.stringify(['foo', 'bar']));

    should(kuzzle.cacheEngine.internal.del)
      .calledWith([`{notif/${index}/${collection}}/${doc2._id}`]);
  });
});
