'use strict';

const should = require('should');
const sinon = require('sinon');

const KuzzleMock = require('../../../mocks/kuzzle.mock');

const Notifier = require('../../../../lib/core/realtime/notifier');

describe('Test: notifier.notifyDocumentDelete', () => {
  let kuzzle;
  let notifier;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    notifier = new Notifier(kuzzle);

    return notifier.init();
  });

  it('should register a "notify:deleted" event', async () => {
    sinon.stub(notifier, 'notifyDocumentMDelete');

    kuzzle.ask.restore();
    await kuzzle.ask('core:realtime:notify:deleted', 'request', 'id', 'src');

    should(notifier.notifyDocumentMDelete)
      .calledWithMatch('request', [{_id: 'id', _source: 'src'}]);
  });
});
