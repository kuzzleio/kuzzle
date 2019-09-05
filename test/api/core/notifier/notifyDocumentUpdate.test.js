'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  { Request } = require('kuzzle-common-objects'),
  Kuzzle = require('../../../mocks/kuzzle.mock'),
  Notifier = require('../../../../lib/api/core/notifier');

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

    kuzzle.realtime.test.returns(['foo']);
    kuzzle.services.publicStorage.get.resolves({
      _id,
      _source: {foo: 'bar'},
      _meta: request.input.body._kuzzle_info
    });

    kuzzle.services.internalCache.get.resolves(
      JSON.stringify(['foo', 'bar']));

    return notifier.notifyDocumentUpdate(request)
      .then(() => {
        should(kuzzle.services.publicStorage.get).calledOnce();

        should(kuzzle.realtime.test)
          .calledOnce()
          .calledWith('foo', 'bar', {foo: 'bar'}, _id);

        should(notifier.notifyDocument.callCount).be.eql(2);
        should(notifier.notifyDocument.getCall(0)).calledWith(
          ['foo'],
          request,
          'in',
          'done',
          'update',
          {
            _id,
            _meta: {canIhas: 'cheezburgers?'},
            _source: {foo: 'bar'},
            _updatedFields: ['foo']
          });

        should(notifier.notifyDocument.getCall(1)).calledWith(
          ['bar'], request, 'out', 'done', 'update', { _id });

        should(kuzzle.services.internalCache.get)
          .calledOnce()
          .calledWith(`{notif/${index}/${collection}}/${_id}`);

        should(kuzzle.services.internalCache.del).not.be.called();

        should(kuzzle.services.internalCache.setex)
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

      kuzzle.realtime.test.returns(['foo']);
      kuzzle.services.publicStorage.get.resolves({
        _id,
        _source: {foo: 'bar'},
        _meta: request.input.body._kuzzle_info
      });

      kuzzle.services.internalCache.get.resolves(
        JSON.stringify(['foo', 'bar']));

      return notifier.notifyDocumentUpdate(request)
        .then(() => {
          should(kuzzle.services.internalCache.setex).not.be.called();

          should(kuzzle.services.internalCache.set)
            .calledOnce()
            .calledWith(
              `{notif/${index}/${collection}}/${_id}`,
              JSON.stringify(['foo']));
        });
    });
  });
});
