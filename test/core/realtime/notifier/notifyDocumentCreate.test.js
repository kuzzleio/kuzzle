'use strict';

const should = require('should');
const sinon = require('sinon');
const { Request } = require('kuzzle-common-objects');

const KuzzleMock = require('../../../mocks/kuzzle.mock');

const Notifier = require('../../../../lib/core/realtime/notifier');

describe('Test: notifier.notifyDocumentCreate', () => {
  let kuzzle;
  let notifier;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    notifier = new Notifier(kuzzle);

    return notifier.init();
  });

  it('should register a "notify:created" event', async () => {
    sinon.stub(notifier, 'notifyDocumentCreate');

    kuzzle.ask.restore();
    await kuzzle.ask('core:realtime:notify:created', 'req', 'id', 'content');

    should(notifier.notifyDocumentCreate).calledWith('req', 'id', 'content');
  });

  it('should send a document notification and cache the result', async () => {
    const rooms = [ 'bar', 'baz' ];
    sinon.stub(notifier, '_setCacheWithTTL');
    sinon.stub(notifier, 'notifyDocument');
    kuzzle.koncorde.test.returns(rooms);

    const request = new Request({
      collection: 'collection',
      index: 'index',
    });
    const id = 'foo';
    const content = { foo: 'bar' };

    await notifier.notifyDocumentCreate(request, id, content);

    should(kuzzle.koncorde.test).calledWith('index', 'collection', content, id);
    should(notifier.notifyDocument)
      .calledWithMatch(rooms, request, 'in', 'create', {
        _id: id,
        _source: content,
      });

    should(notifier._setCacheWithTTL)
      .calledWithMatch(`{notif/index/collection}/${id}`, JSON.stringify(rooms));
  });
});
