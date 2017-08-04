'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  Bluebird = require('bluebird'),
  Request = require('kuzzle-common-objects').Request,
  Kuzzle = require('../../../mocks/kuzzle.mock'),
  Notifier = require.main.require('lib/api/core/notifier');

describe('Test: notifier.notifyDocumentDelete', () => {
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
    return notifier.notifyDocumentDelete(request, [])
      .then(() => {
        should(notifier.notifyDocument.called).be.false();
      });
  });

  it('should notify when a document has been deleted', () => {
    const
      stillAlive = {
        _meta: {
          'This is a triumph': 'I\'m making a not here: HUGE SUCCESS',
          'It\'s hard to overstate': 'my satisfaction',
          'Aperture Science': 'We do what we must, because we can',
          'For the good of all of us': 'Except the ones who are dead',

          'There\'s no point crying': 'over every mistake',

          'You just keep on trying': 'till you run out of cake',
          'And the science gets done': 'and you make a neat gun',
          'For the people who are': 'still alive'
        },
        _source: {
          'I\'m not even angry': 'I\'m being so sincere right now',
          'Even though you broke my heart': 'and killed me',
          'And tore me to pieces': 'And threw every piece into A FIRE',
          'As they burned it hurt because': 'I was so happy for you',

          'Now these points of data': 'make a beautiful line',
          'We\'re out of beta': 'we\'re releasing on time',
          'And I\'m GLAD I got burned': 'think of all the things we learned',
          'For the people who are': 'still alive'
        }
      };

    kuzzle.dsl.test.returns(['foo', 'bar']);
    kuzzle.services.list.storageEngine.get.returns(Bluebird.resolve({_id: 'foobar', _source: stillAlive._source, _meta: stillAlive._meta}));

    return notifier.notifyDocumentDelete(request, ['foobar'])
      .then(id => {
        should(id[0]).be.exactly('foobar');

        should(notifier.notifyDocument)
          .calledOnce()
          .calledWith(['foo', 'bar'], request, 'out', 'done', 'delete', {
            _meta: stillAlive._meta,
            _id: 'foobar'
          });
      });
  });

  it('should notify for each document when multiple document have been deleted', () => {
    var ids = ['foo', 'bar'];

    kuzzle.services.list.storageEngine.get
      .onFirstCall().returns(Bluebird.resolve({_id: 'foo'}))
      .onSecondCall().returns(Bluebird.resolve({_id: 'bar'}));
      
    return notifier.notifyDocumentDelete(request, ids)
      .then(() => {
        should(notifier.notifyDocument.callCount).be.eql(2);
        should(notifier.notifyDocument.getCall(0).args[5]._id).be.eql('foo');
        should(notifier.notifyDocument.getCall(1).args[5]._id).be.eql('bar');
      });
  });
});
