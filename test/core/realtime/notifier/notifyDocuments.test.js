'use strict';

const should = require('should');
const sinon = require('sinon');
const {
  Request,
  InternalError: KuzzleInternalError,
} = require('kuzzle-common-objects');

const KuzzleMock = require('../../../mocks/kuzzle.mock');

const Notifier = require('../../../../lib/core/realtime/notifier');
const actionEnum = require('../../../../lib/core/realtime/actionEnum');

describe('#notifier.notifyDocuments', () => {
  const index = 'index';
  const collection = 'collection';
  let kuzzle;
  let notifier;
  let document;
  let request;
  let ttl;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    ttl = kuzzle.config.limits.subscriptionDocumentTTL;

    notifier = new Notifier(kuzzle);

    request = new Request({collection, index});
    document = {
      _id: 'foo',
      _source: 'bar',
    };

    return notifier.init();
  });

  it('should register a "document:notify" event', async () => {
    sinon.stub(notifier, 'notifyDocuments');

    kuzzle.ask.restore();
    await kuzzle.ask('core:realtime:document:notify', 'req', 'action', 'doc');

    should(notifier.notifyDocuments).calledWith('req', 'action', ['doc']);
  });

  it('should register a "document:mNotify" event', async () => {
    sinon.stub(notifier, 'notifyDocuments');

    kuzzle.ask.restore();
    await kuzzle.ask('core:realtime:document:mNotify', 'req', 'action', 'doc');

    should(notifier.notifyDocuments).calledWith('req', 'action', 'doc');
  });

  describe('cache management', () => {
    beforeEach(() => {
      sinon.stub(notifier, 'notifyDocumentCreate');
    });

    it('should put the result rooms in cache', async () => {
      const rooms = ['foo', 'bar'];
      notifier.notifyDocumentCreate.resolves(rooms);

      await notifier.notifyDocuments(request, actionEnum.CREATE, [
        { _id: 'foo' },
        { _id: 'bar' },
        { _id: 'baz' },
      ]);

      should(kuzzle.cacheEngine.internal.mget).not.called();
      should(kuzzle.cacheEngine.internal.del).not.called();

      should(kuzzle.cacheEngine.internal.setex)
        .calledThrice()
        .calledWith(
          `{notif/${index}/${collection}}/foo`,
          ttl,
          JSON.stringify(rooms))
        .calledWith(
          `{notif/${index}/${collection}}/bar`,
          ttl,
          JSON.stringify(rooms))
        .calledWith(
          `{notif/${index}/${collection}}/baz`,
          ttl,
          JSON.stringify(rooms));
    });

    it('should put the result rooms in cache forever (TTL = 0)', async () => {
      notifier.ttl = 0;

      const rooms = ['foo', 'bar'];
      notifier.notifyDocumentCreate.resolves(rooms);

      await notifier.notifyDocuments(request, actionEnum.CREATE, [
        { _id: 'foo' },
        { _id: 'bar' },
        { _id: 'baz' },
      ]);

      should(kuzzle.cacheEngine.internal.mget).not.called();
      should(kuzzle.cacheEngine.internal.del).not.called();
      should(kuzzle.cacheEngine.internal.setex).not.called();

      should(kuzzle.cacheEngine.internal.set)
        .calledThrice()
        .calledWith(
          `{notif/${index}/${collection}}/foo`,
          JSON.stringify(rooms))
        .calledWith(
          `{notif/${index}/${collection}}/bar`,
          JSON.stringify(rooms))
        .calledWith(
          `{notif/${index}/${collection}}/baz`,
          JSON.stringify(rooms));
    });

    it('should delete the cache key if documents does not match rooms', async () => {
      notifier.notifyDocumentCreate.onFirstCall().resolves([]);
      notifier.notifyDocumentCreate.onSecondCall().resolves(['foo', 'bar']);
      notifier.notifyDocumentCreate.onThirdCall().resolves([]);

      await notifier.notifyDocuments(request, actionEnum.CREATE, [
        { _id: 'foo' },
        { _id: 'bar' },
        { _id: 'baz' },
      ]);

      should(kuzzle.cacheEngine.internal.mget).not.called();
      should(kuzzle.cacheEngine.internal.setex)
        .calledOnce()
        .calledWith(
          `{notif/${index}/${collection}}/bar`,
          ttl,
          JSON.stringify(['foo', 'bar']));

      should(kuzzle.cacheEngine.internal.del)
        .calledOnce()
        .calledWith([
          `{notif/${index}/${collection}}/foo`,
          `{notif/${index}/${collection}}/baz`,
        ]);
    });
  });

  describe('notifier function calls', () => {
    it('"document created" notification', async () => {
      sinon.stub(notifier, 'notifyDocumentCreate').resolves([]);

      await notifier.notifyDocuments(request, actionEnum.CREATE, [
        document,
        document,
        document,
      ]);

      should(notifier.notifyDocumentCreate)
        .calledThrice()
        .alwaysCalledWith(request, document);

      should(kuzzle.cacheEngine.internal.mget).not.called();
    });

    it('"document deleted" notification', async () => {
      sinon.stub(notifier, 'notifyDocumentDelete').resolves([]);

      await notifier.notifyDocuments(request, actionEnum.DELETE, [
        document,
        document,
        document,
      ]);

      should(notifier.notifyDocumentDelete)
        .calledThrice()
        .alwaysCalledWith(request, document);

      should(kuzzle.cacheEngine.internal.mget).not.called();
    });

    it('"document updated" notification', async () => {
      const cacheResult = [
        'foo',
        'bar',
        'baz',
      ];

      kuzzle.cacheEngine.internal.mget.resolves(cacheResult);

      sinon.stub(notifier, 'notifyDocumentUpdate').resolves([]);

      await notifier.notifyDocuments(request, actionEnum.UPDATE, [
        { _id: 'foo' },
        { _id: 'bar' },
        { _id: 'baz' },
      ]);

      should(notifier.notifyDocumentUpdate).calledThrice();

      should(notifier.notifyDocumentUpdate.firstCall)
        .calledWith(request, { _id: 'foo' }, cacheResult[0]);

      should(notifier.notifyDocumentUpdate.secondCall)
        .calledWith(request, { _id: 'bar' }, cacheResult[1]);

      should(notifier.notifyDocumentUpdate.thirdCall)
        .calledWith(request, { _id: 'baz' }, cacheResult[2]);

      should(kuzzle.cacheEngine.internal.mget).calledWith([
        `{notif/${index}/${collection}}/foo`,
        `{notif/${index}/${collection}}/bar`,
        `{notif/${index}/${collection}}/baz`,
      ]);
    });

    it('"document replaced" notification', async () => {
      const cacheResult = [
        'foo',
        'bar',
        'baz',
      ];

      kuzzle.cacheEngine.internal.mget.resolves(cacheResult);

      sinon.stub(notifier, 'notifyDocumentReplace').resolves([]);

      await notifier.notifyDocuments(request, actionEnum.REPLACE, [
        { _id: 'foo' },
        { _id: 'bar' },
        { _id: 'baz' },
      ]);

      should(notifier.notifyDocumentReplace).calledThrice();

      should(notifier.notifyDocumentReplace.firstCall)
        .calledWith(request, { _id: 'foo' }, cacheResult[0]);

      should(notifier.notifyDocumentReplace.secondCall)
        .calledWith(request, { _id: 'bar' }, cacheResult[1]);

      should(notifier.notifyDocumentReplace.thirdCall)
        .calledWith(request, { _id: 'baz' }, cacheResult[2]);

      should(kuzzle.cacheEngine.internal.mget).calledWith([
        `{notif/${index}/${collection}}/foo`,
        `{notif/${index}/${collection}}/bar`,
        `{notif/${index}/${collection}}/baz`,
      ]);
    });

    it('"document created/replaced" notification (at least 1 replace)', async () => {
      const cacheResult = [
        undefined,
        'bar',
        undefined,
      ];

      kuzzle.cacheEngine.internal.mget.resolves(cacheResult);

      sinon.stub(notifier, 'notifyDocumentCreate').resolves([]);
      sinon.stub(notifier, 'notifyDocumentReplace').resolves([]);

      await notifier.notifyDocuments(request, actionEnum.WRITE, [
        { _id: 'foo', created: true },
        { _id: 'bar', created: false },
        { _id: 'baz', created: true },
      ]);

      should(notifier.notifyDocumentCreate).calledTwice();
      should(notifier.notifyDocumentReplace).calledOnce();

      should(notifier.notifyDocumentCreate.firstCall)
        .calledWith(request, { _id: 'foo', created: true });

      should(notifier.notifyDocumentCreate.secondCall)
        .calledWith(request, { _id: 'baz', created: true });

      should(notifier.notifyDocumentReplace)
        .calledWith(request, { _id: 'bar', created: false }, cacheResult[1]);

      should(kuzzle.cacheEngine.internal.mget).calledWith([
        `{notif/${index}/${collection}}/foo`,
        `{notif/${index}/${collection}}/bar`,
        `{notif/${index}/${collection}}/baz`,
      ]);
    });

    it('"document created/replaced" notification (no replace)', async () => {
      sinon.stub(notifier, 'notifyDocumentCreate').resolves([]);
      sinon.stub(notifier, 'notifyDocumentReplace').resolves([]);

      await notifier.notifyDocuments(request, actionEnum.WRITE, [
        { _id: 'foo', created: true },
        { _id: 'bar', created: true },
        { _id: 'baz', created: true },
      ]);

      should(notifier.notifyDocumentCreate).calledThrice();
      should(notifier.notifyDocumentReplace).not.called();

      should(notifier.notifyDocumentCreate.firstCall)
        .calledWith(request, { _id: 'foo', created: true });

      should(notifier.notifyDocumentCreate.secondCall)
        .calledWith(request, { _id: 'bar', created: true });

      should(notifier.notifyDocumentCreate.thirdCall)
        .calledWith(request, { _id: 'baz', created: true });

      should(kuzzle.cacheEngine.internal.mget).not.called();
    });

    it('should throw on an unknown action', () => {
      return should(notifier.notifyDocuments(request, 'ohnoes', [document]))
        .rejectedWith(KuzzleInternalError, { id: 'core.fatal.assertion_failed' });
    });
  });
});
