const
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  RealtimeController = require('../../../lib/api/controllers/realtimeController'),
  Request = require('kuzzle-common-objects').Request,
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError;

describe('Test: subscribe controller', () => {
  let
    kuzzle,
    request,
    realtimeController,
    foo = {foo: 'bar'};

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    realtimeController = new RealtimeController(kuzzle);
    request = new Request({index: 'test', collection: 'collection', controller: 'realtime', body: {}}, {user: {_id: '42'}});
    kuzzle.repositories.user.anonymous = sinon.stub();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#subscribe', () => {
    it('should throw an error if index is not provided',() => {
      request.input.resource.index = null;

      should(() => {
        realtimeController.subscribe(request);
      }).throw(BadRequestError);
    });

    it('should throw an error if collection is not provided',() => {
      request.input.resource.collection = null;

      should(() => {
        realtimeController.subscribe(request);
      }).throw(BadRequestError);
    });

    it('should throw an error if body is not provided',() => {
      request.input.body = null;

      should(() => {
        realtimeController.subscribe(request);
      }).throw(BadRequestError);
    });

    it('should call the proper hotelClerk method',() => {
      return realtimeController.subscribe(request)
        .then(result => {
          should(result).be.match(foo);
          should(kuzzle.hotelClerk.addSubscription).be.calledOnce();
          should(kuzzle.hotelClerk.addSubscription).be.calledWith(request);
        });
    });
  });

  describe('#join', () => {
    it('should throw an error if body is not provided',() => {
      request.input.body = null;

      return should(() => realtimeController.join(request))
        .throw(BadRequestError);
    });

    it('should throw an error if roomId is not provided',() => {
      return should(() => realtimeController.join(request))
        .throw(BadRequestError);
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
  });

  describe('#unsubscribe', () => {
    it('should throw an error if body is not provided',() => {
      request.input.body = null;

      should(() => {
        realtimeController.unsubscribe(request);
      }).throw(BadRequestError);
    });

    it('should throw an error if roomId is not provided',() => {
      should(() => {
        realtimeController.unsubscribe(request);
      }).throw(BadRequestError);
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

      should(() => {
        realtimeController.count(request);
      }).throw(BadRequestError);
    });

    it('should throw an error if roomId is not provided',() => {
      should(() => {
        realtimeController.count(request);
      }).throw(BadRequestError);
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
    it('should resolve to a valid response', () => {
      request.input.resource.index = '%test';
      request.input.resource.collection = 'test-collection';

      return realtimeController.publish(request)
        .then(response => {
          try {
            should(kuzzle.validation.validationPromise).be.calledOnce();

            should(kuzzle.notifier.publish).be.calledOnce();
            should(kuzzle.notifier.publish).be.calledWith(request);

            should(response).be.instanceof(Object);
            should(response).match(foo);

            return Promise.resolve();
          }
          catch(error) {
            return Promise.reject(error);
          }
        });
    });
  });
});
