'use strict';

const should = require('should');
const sinon = require('sinon');

const { Request } = require('../../../../index');
const KuzzleMock = require('../../../mocks/kuzzle.mock');

const Notifier = require('../../../../lib/core/realtime/notifier');

describe('Test: notifier.notifyDocumentUpdate', () => {
  let kuzzle;
  let notifier;
  let request;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    notifier = new Notifier();

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

  it('should notify subscribers when an updated document entered their scope', async () => {
    const _id = request.input.args._id;

    kuzzle.koncorde.test.returns(['foo']);

    const rooms = await notifier.notifyDocumentUpdate(
      request,
      {
        _id,
        _source: { foo: 'bar' },
        _updatedFields: ['foo'],
      },
      JSON.stringify(['foo', 'bar']));

    should(kuzzle.koncorde.test)
      .calledOnce()
      .calledWith({ _id, foo: 'bar' }, 'foo/bar');

    should(notifier.notifyDocument.callCount).be.eql(2);
    should(notifier.notifyDocument.getCall(0))
      .calledWith(['foo'], request, 'in', 'update', {
        _id,
        _source: { foo: 'bar' },
        _updatedFields: ['foo'],
      });

    should(notifier.notifyDocument.getCall(1))
      .calledWith(['bar'], request, 'out', 'update', {
        _id,
        _source: { foo: 'bar' },
        _updatedFields: ['foo']
      });

    should(rooms).match(['foo']);
  });

  it('should remove the cache entry if no room matches the updated document', async () => {
    kuzzle.koncorde.test.returns([]);

    const rooms = await notifier.notifyDocumentUpdate(
      request,
      {
        _id: request.input.args._id,
        _source: { foo: 'bar' }
      },
      JSON.stringify(['foo', 'bar']));

    should(rooms).be.an.Array().and.be.empty();
  });
});
