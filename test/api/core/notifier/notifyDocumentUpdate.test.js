'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  Bluebird = require('bluebird'),
  Request = require('kuzzle-common-objects').Request,
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

    notifier.notifyDocument = sinon.stub();
  });

  it('should notify subscribers when an updated document entered their scope', () => {
    kuzzle.realtime.test.returns(['foo']);
    kuzzle.services.list.storageEngine.get.returns(Bluebird.resolve({
      _id: request.input.resource._id,
      _source: {foo: 'bar'},
      _meta: request.input.body._kuzzle_info
    }));

    kuzzle.services.list.internalCache.get.resolves(JSON.stringify(['foo', 'bar']));

    return notifier.notifyDocumentUpdate(request)
      .then(() => {
        should(kuzzle.services.list.storageEngine.get).calledOnce();

        should(kuzzle.realtime.test)
          .calledOnce()
          .calledWith('foo', 'bar', {foo: 'bar'}, request.input.resource._id);

        should(notifier.notifyDocument.callCount).be.eql(2);
        should(notifier.notifyDocument.getCall(0)).calledWith(['foo'], request, 'in', 'done', 'update', {
          _meta: {canIhas: 'cheezburgers?'},
          _source: {foo: 'bar'},
          _id: request.input.resource._id
        });

        should(notifier.notifyDocument.getCall(1)).calledWith(['bar'], request, 'out', 'done', 'update', {
          _id: request.input.resource._id
        });

        should(kuzzle.services.list.internalCache.get)
          .calledOnce()
          .calledWith(`{notif/${request.input.resource.index}/${request.input.resource.collection}}/${request.input.resource._id}`);

        should(kuzzle.services.list.internalCache.del).not.be.called();

        should(kuzzle.services.list.internalCache.setex)
          .calledOnce()
          .calledWith(
            `{notif/${request.input.resource.index}/${request.input.resource.collection}}/${request.input.resource._id}`,
            kuzzle.config.limits.subscriptionDocumentTTL,
            JSON.stringify(['foo']));
      });
  });

  context('with a subscriptionDocumentTTL set to 0', () => {
    it('should set internalCache with no TTL', () => {
      kuzzle.config.limits.subscriptionDocumentTTL = 0;

      kuzzle.realtime.test.returns(['foo']);
      kuzzle.services.list.storageEngine.get.returns(Bluebird.resolve({
        _id: request.input.resource._id,
        _source: {foo: 'bar'},
        _meta: request.input.body._kuzzle_info
      }));

      kuzzle.services.list.internalCache.get.resolves(JSON.stringify(['foo', 'bar']));

      return notifier.notifyDocumentUpdate(request)
        .then(() => {
          should(kuzzle.services.list.internalCache.setex).not.be.called();

          should(kuzzle.services.list.internalCache.set)
            .calledOnce()
            .calledWith(
              `{notif/${request.input.resource.index}/${request.input.resource.collection}}/${request.input.resource._id}`,
              JSON.stringify(['foo']));
        });
    });
  });
});
