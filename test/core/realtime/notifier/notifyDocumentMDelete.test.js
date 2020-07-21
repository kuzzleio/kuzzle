'use strict';

const should = require('should');
const sinon = require('sinon');
const { Request } = require('kuzzle-common-objects');

const KuzzleMock = require('../../../mocks/kuzzle.mock');

const Notifier = require('../../../../lib/core/realtime/notifier');

describe('Test: notifier.notifyDocumentMDelete', () => {
  let kuzzle;
  let request;
  let notifier;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    notifier = new Notifier(kuzzle);

    request = new Request({
      controller: 'document',
      action: 'delete',
      requestId: 'foo',
      collection: 'bar',
      body: {foo: 'bar'}
    });

    notifier.notifyDocument = sinon.stub();

    return notifier.init();
  });

  it('should register a "notify:mDeleted" event', async () => {
    sinon.stub(notifier, 'notifyDocumentMDelete');

    kuzzle.ask.restore();
    await kuzzle.ask('core:realtime:notify:mDeleted', 'request', 'docs');

    should(notifier.notifyDocumentMDelete).calledWith('request', 'docs');
  });

  it('should do nothing if no document is provided', async () => {
    await notifier.notifyDocumentMDelete(request, []);

    should(notifier.notifyDocument).not.be.called();
  });

  it('should notify when a document has been deleted', async () => {
    const stillAlive = {
      'I\'m not even angry': 'I\'m being so sincere right now',
      'Even though you broke my heart': 'and killed me',
      'And tore me to pieces': 'And threw every piece into A FIRE',
      'As they burned it hurt because': 'I was so happy for you',

      'Now these points of data': 'make a beautiful line',
      'We\'re out of beta': 'we\'re releasing on time',
      'And I\'m GLaD I got burned': 'think of all the things we learned',
      'For the people who are': 'still alive'
    };

    kuzzle.koncorde.test.returns(['foo', 'bar']);
    kuzzle.storageEngine.public.mGet.resolves({
      items: [
        { _id: 'foobar', _source: stillAlive }
      ],
      total: 1,
    });

    await notifier.notifyDocumentMDelete(request, [
      { _id: 'foobar', _source: stillAlive }
    ]);

    should(notifier.notifyDocument)
      .calledOnce()
      .calledWith(['foo', 'bar'], request, 'out', 'delete', { _id: 'foobar' });
  });

  it('should notify for each document when multiple document have been deleted', async () => {
    const documents = [{ _id: 'foo' }, { _id: 'bar' }];

    kuzzle.storageEngine.public.mGet.resolves({
      items: [
        {_id: 'foo'},
        {_id: 'bar'}
      ],
      total: 2,
    });

    await notifier.notifyDocumentMDelete(request, documents);

    should(notifier.notifyDocument.callCount).be.eql(2);
    should(notifier.notifyDocument.getCall(0).args[4]._id).be.eql('foo');
    should(notifier.notifyDocument.getCall(1).args[4]._id).be.eql('bar');
  });
});
