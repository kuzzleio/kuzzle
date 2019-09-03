'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  { Request } = require('kuzzle-common-objects'),
  Kuzzle = require('../../../mocks/kuzzle.mock'),
  Notifier = require('../../../../lib/api/core/notifier');

describe('Test: notifier.notifyDocumentMDelete', () => {
  let
    kuzzle,
    request,
    notifier;

  beforeEach(() => {
    kuzzle = new Kuzzle();
    notifier = new Notifier(kuzzle);

    request = new Request({
      controller: 'document',
      action: 'delete',
      requestId: 'foo',
      collection: 'bar',
      body: {foo: 'bar'}
    });

    notifier.notifyDocument = sinon.stub();
  });

  it('should do nothing if no id is provided', () => {
    return notifier.notifyDocumentMDelete(request, [])
      .then(() => {
        should(notifier.notifyDocument).not.be.called();
      });
  });

  it('should notify when a document has been deleted', () => {
    const
      stillAlive = {
        _source: {
          'I\'m not even angry': 'I\'m being so sincere right now',
          'Even though you broke my heart': 'and killed me',
          'And tore me to pieces': 'And threw every piece into A FIRE',
          'As they burned it hurt because': 'I was so happy for you',

          'Now these points of data': 'make a beautiful line',
          'We\'re out of beta': 'we\'re releasing on time',
          'And I\'m GLaD I got burned': 'think of all the things we learned',
          'For the people who are': 'still alive'
        }
      };

    kuzzle.realtime.test.returns(['foo', 'bar']);
    kuzzle.services.publicStorage.mGet.resolves({
      hits: [
        { _id: 'foobar', _source: stillAlive._source }
      ],
      total: 1
    });

    return notifier.notifyDocumentMDelete(request, ['foobar'])
      .then(() => {
        should(notifier.notifyDocument)
          .calledOnce()
          .calledWith(['foo', 'bar'], request, 'out', 'delete', {
            _id: 'foobar'
          });
      });
  });

  it('should notify for each document when multiple document have been deleted', () => {
    const ids = ['foo', 'bar'];

    kuzzle.services.publicStorage.mGet.resolves({
      hits: [
        {_id: 'foo'},
        {_id: 'bar'}
      ],
      total: 2
    });

    return notifier.notifyDocumentMDelete(request, ids)
      .then(() => {
        should(notifier.notifyDocument.callCount).be.eql(2);
        should(notifier.notifyDocument.getCall(0).args[4]._id).be.eql('foo');
        should(notifier.notifyDocument.getCall(1).args[4]._id).be.eql('bar');
      });
  });
});
