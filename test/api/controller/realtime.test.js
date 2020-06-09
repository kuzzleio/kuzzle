'use strict';

const should = require('should');
const sinon = require('sinon');
const KuzzleMock = require('../../mocks/kuzzle.mock');
const RealtimeController = require('../../../lib/api/controller/realtime');
const {
  Request,
  errors: { BadRequestError }
} = require('kuzzle-common-objects');
const { NativeController } = require('../../../lib/api/controller/base');

describe('RealtimeController', () => {
  let
    kuzzle,
    request,
    realtimeController,
    foo = {foo: 'bar'};

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    realtimeController = new RealtimeController(kuzzle);
    request = new Request({
      index: 'test',
      collection: 'collection',
      controller: 'realtime',
      body: {}
    }, {user: {_id: '42'}});

    kuzzle.repositories.user.anonymous = sinon.stub();
  });

  describe('#constructor', () => {
    it('should inherit the base constructor', () => {
      should(realtimeController).instanceOf(NativeController);
    });
  });

  describe('#subscribe', () => {
    it('should reject if no index is provided',() => {
      request.input.resource.index = null;

      should(realtimeController.subscribe(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.missing_argument' });
    });

    it('should reject if no collection is provided',() => {
      request.input.resource.collection = null;

      should(realtimeController.subscribe(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.missing_argument' });
    });

    it('should reject if no body is provided',() => {
      request.input.body = null;

      should(realtimeController.subscribe(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.body_required' });
    });

    it('should call the proper hotelClerk method',() => {
      return realtimeController.subscribe(request)
        .then(result => {
          should(result).be.match(foo);
          should(kuzzle.hotelClerk.addSubscription).be.calledOnce();
          should(kuzzle.hotelClerk.addSubscription).be.calledWith(request);
          should(request.input.args.cluster).be.true()
        });
    });

    it('should handle cluster flag',() => {
      request.input.args.cluster = false;

      return realtimeController.subscribe(request)
        .then(result => {
          const req = kuzzle.hotelClerk.addSubscription.getCall(0).args[0];
          should(req.input.args.cluster).be.false()
        });
    });

    it('should return nothing if the connection is dead', async () => {
      // the check is actually done in the hotelclerk and returns undefined if so
      kuzzle.hotelClerk.addSubscription.resolves();

      const result = await realtimeController.subscribe(request);

      should(result).be.null();
    });
  });

  describe('#join', () => {
    it('should reject an error if body is not provided',() => {
      request.input.body = null;

      return should(realtimeController.join(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.body_required' });
    });

    it('should throw an error if roomId is not provided',() => {
      return should(realtimeController.join(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.missing_argument' });
    });

    it('should call the proper hotelClerk method',() => {
      request.input.body.roomId = 'foo';

      return realtimeController.join(request)
        .then(result => {
          should(result).be.match(foo);
          should(kuzzle.hotelClerk.join).be.calledOnce();
          should(kuzzle.hotelClerk.join).be.calledWith(request);
        });
    });

    it('should return nothing if the connection is dead', async () => {
      // the check is actually done in the hotelclerk and returns null if so
      kuzzle.hotelClerk.addSubscription.resolves();

      const result = await realtimeController.subscribe(request);

      should(result).be.null();
    });
  });

  describe('#unsubscribe', () => {
    it('should throw an error if body is not provided',() => {
      request.input.body = null;

      return should(realtimeController.unsubscribe(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.body_required' });
    });

    it('should throw an error if roomId is not provided',() => {
      return should(realtimeController.unsubscribe(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.missing_argument' });
    });

    it('should call the proper hotelClerk method',() => {
      request.input.body.roomId = 'foo';

      return realtimeController.unsubscribe(request)
        .then(result => {
          should(result).be.match(foo);
          should(kuzzle.hotelClerk.removeSubscription).be.calledOnce();
          should(kuzzle.hotelClerk.removeSubscription).be.calledWith(request);
        });
    });
  });

  describe('#count', () => {
    it('should throw an error if body is not provided',() => {
      request.input.body = null;

      return should(realtimeController.count(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.body_required' });
    });

    it('should throw an error if roomId is not provided',() => {
      return should(realtimeController.count(request))
        .rejectedWith(BadRequestError, { id: 'api.assert.missing_argument' });
    });

    it('should call the proper hotelClerk method',() => {
      request.input.body.roomId = 'foo';

      return realtimeController.count(request)
        .then(result => {
          should(result).be.match(foo);
          should(kuzzle.hotelClerk.countSubscription).be.calledOnce();
          should(kuzzle.hotelClerk.countSubscription).be.calledWith(request);
        });
    });
  });

  describe('#list', () => {
    it('should call the proper hotelClerk method',() => {
      kuzzle.repositories.user.anonymous.returns({_id: '-1'});

      return realtimeController.list(request)
        .then(result => {
          should(result).be.match(foo);
          should(kuzzle.hotelClerk.listSubscriptions).be.calledOnce();
          should(kuzzle.hotelClerk.listSubscriptions).be.calledWith(request);
        });
    });
  });

  describe('#publish', () => {
    beforeEach(() => {
      request.input.resource.index = '%test';
      request.input.resource.collection = 'test-collection';
    });

    it('should resolve to a valid response', async () => {
      const response = await realtimeController.publish(request);

      should(kuzzle.validation.validate).be.calledOnce();

      should(kuzzle.notifier.publish).be.calledOnce();
      should(kuzzle.notifier.publish).be.calledWith(request);

      should(response).match({published: true});
    });

    it('should add basic metadata to body', async () => {
      await realtimeController.publish(request);

      should(kuzzle.notifier.publish).be.calledOnce();

      const req = kuzzle.notifier.publish.getCall(0).args[0];
      should(req.input.body._kuzzle_info).be.instanceof(Object);
      should(req.input.body._kuzzle_info.author).be.eql('42');
      should(req.input.body._kuzzle_info.createdAt).be.approximately(Date.now(), 100);
    });

    it('should allow to publish without user in context', async () => {
      request.context.user = undefined;

      const response = await realtimeController.publish(request);

      should(kuzzle.validation.validate).be.calledOnce();

      should(kuzzle.notifier.publish).be.calledOnce();
      should(kuzzle.notifier.publish).be.calledWith(request);

      should(response).match({published: true});
    });

  });
});
