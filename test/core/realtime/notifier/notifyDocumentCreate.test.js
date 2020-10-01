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

  it('should send a document notification and return the matched rooms', async () => {
    const rooms = [ 'bar', 'baz' ];
    sinon.stub(notifier, 'notifyDocument');
    kuzzle.koncorde.test.returns(rooms);

    const request = new Request({
      collection: 'collection',
      index: 'index',
    });
    const _id = 'foo';
    const _source = { foo: 'bar' };

    const result = await notifier.notifyDocumentCreate(request, { _id, _source });

    should(kuzzle.koncorde.test).calledWith('index', 'collection', _source, _id);
    should(notifier.notifyDocument)
      .calledWithMatch(rooms, request, 'in', 'create', { _id, _source });
    should(result).match(rooms);
  });
});
