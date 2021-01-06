'use strict';

const should = require('should');
const RealtimeController = require('../../../lib/api/controller/realtime');

const {
  Request,
  BadRequestError
} = require('../../../index');
const KuzzleMock = require('../../mocks/kuzzle.mock');

const { NativeController } = require('../../../lib/api/controller/base');

describe('RealtimeController', () => {
  let kuzzle;
  let request;
  let realtimeController;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    realtimeController = new RealtimeController();
    request = new Request(
      {
        index: 'test',
        collection: 'collection',
        controller: 'realtime',
        body: {}
      },
      {
        connection: {id: 'connectionId'},
        user: {_id: '42'},
      });
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

    it('should ask for the proper realtime event', async () => {
      const subscribeResult = { roomId: 'foo', channel: 'bar' };
      const stub = kuzzle.ask
        .withArgs('core:realtime:subscribe', request)
        .resolves(subscribeResult);
      const result = await realtimeController.subscribe(request);

      should(result).be.match(subscribeResult);
      should(stub).calledOnce();
      should(request.input.args.propagate).be.true();
    });

    it('should handle propagate flag only with funnel protocol', async () => {
      const stub = kuzzle.ask.withArgs('core:realtime:subscribe', request);

      request.context.connection.protocol = 'funnel';
      request.input.args.propagate = false;

      await realtimeController.subscribe(request);

      let req = stub.getCall(0).args[1];
      should(req.input.args.propagate).be.false();

      request.context.connection.protocol = 'http';
      request.input.args.propagate = false;

      await realtimeController.subscribe(request);

      req = stub.getCall(1).args[1];
      should(req.input.args.propagate).be.true();
    });

    it('should return nothing if the subscription is not performed', async () => {
      kuzzle.ask.withArgs('core:realtime:subscribe').resolves(null);

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

    it('should ask for the correct ask event', async () => {
      const expected = { roomId: 'foo', channel: 'bar' };
      request.input.body.roomId = 'foo';

      kuzzle.ask.withArgs('core:realtime:join', request).resolves(expected);

      const result = await realtimeController.join(request);

      should(kuzzle.ask).calledWithMatch('core:realtime:join', request);
      should(result).match(expected);
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

    it('should send the correct ask event', async () => {
      request.input.body.roomId = 'foo';

      const result = await realtimeController.unsubscribe(request);

      should(result).be.match({ roomId: 'foo' });
      should(kuzzle.ask)
        .calledWithMatch('core:realtime:unsubscribe', 'connectionId', 'foo');
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

    it('should send the correct ask event', async () => {
      const stub = kuzzle.ask
        .withArgs('core:realtime:room:size:get', 'foo')
        .resolves(42);

      request.input.body.roomId = 'foo';

      const result = await realtimeController.count(request);

      should(result).match({ count: 42 });
      should(stub).calledOnce();
    });
  });

  describe('#list', () => {
    it('should ask for the proper realtime event', async () => {
      await realtimeController.list(request);
      should(kuzzle.ask)
        .calledWith('core:realtime:list', request.context.user);
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

      should(kuzzle.ask).be.calledWithMatch('core:realtime:publish', request);

      should(response).match({published: true});
    });

    it('should add basic metadata to body', async () => {
      await realtimeController.publish(request);

      should(kuzzle.ask).calledWithMatch('core:realtime:publish', request);

      const req = kuzzle.ask
        .withArgs('core:realtime:publish')
        .getCall(0)
        .args[1];

      should(req.input.body._kuzzle_info).be.instanceof(Object);
      should(req.input.body._kuzzle_info.author).be.eql('42');
      should(req.input.body._kuzzle_info.createdAt).be.approximately(Date.now(), 100);
    });

    it('should allow to publish without user in context', async () => {
      request.context.user = undefined;

      const response = await realtimeController.publish(request);

      should(kuzzle.validation.validate).be.calledOnce();

      should(kuzzle.ask).calledWithMatch('core:realtime:publish', request);

      should(response).match({published: true});
    });

  });
});
