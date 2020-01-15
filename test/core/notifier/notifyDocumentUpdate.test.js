'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  { Request } = require('kuzzle-common-objects'),
  Kuzzle = require('../../mocks/kuzzle.mock'),
  Notifier = require('../../../lib/core/notifier');

describe('Test: notifier.notifyDocumentUpdate', () => {
  let
    kuzzle,
    notifier,
    request;

  beforeEach(() => {
    kuzzle = new Kuzzle();
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
  });

  it('should notify subscribers when an updated document entered their scope', () => {
    const {_id, index, collection} = request.input.resource;

    kuzzle.koncorde.test.returns(['foo']);
    kuzzle.storageEngine.public.get.resolves({
      _id,
      _source: {foo: 'bar'}
    });

    kuzzle.cacheEngine.internal.get.resolves(
      JSON.stringify(['foo', 'bar']));

    return notifier.notifyDocumentUpdate(request, {
      _id,
      _source: { foo: 'bar' },
      _updatedFields: ['foo']
    })
      .then(() => {

        should(kuzzle.koncorde.test)
          .calledOnce()
          .calledWith('foo', 'bar', {foo: 'bar'}, _id);

        should(notifier.notifyDocument.callCount).be.eql(2);
        should(notifier.notifyDocument.getCall(0)).calledWith(
          ['foo'],
          request,
          'in',
          'update',
          {
            _id,
            _source: { foo: 'bar' },
            _updatedFields: ['foo']
          });

        should(notifier.notifyDocument.getCall(1)).calledWith(
          ['bar'], request, 'out', 'update', { _id });

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
  });

  context('with a subscriptionDocumentTTL set to 0', () => {
    it('should set internalCache with no TTL', () => {
      const {_id, index, collection} = request.input.resource;

      kuzzle.config.limits.subscriptionDocumentTTL = 0;

      kuzzle.koncorde.test.returns(['foo']);
      kuzzle.storageEngine.public.get.resolves({
        _id,
        _source: {foo: 'bar'}
      });

      kuzzle.cacheEngine.internal.get.resolves(
        JSON.stringify(['foo', 'bar']));

      return notifier
        .notifyDocumentUpdate(request, {
          _id,
          _source: { foo: 'bar' }
        })
        .then(() => {
          should(kuzzle.cacheEngine.internal.setex).not.be.called();

          should(kuzzle.cacheEngine.internal.set)
            .calledOnce()
            .calledWith(
              `{notif/${index}/${collection}}/${_id}`,
              JSON.stringify(['foo']));
        });
    });
  });
});
