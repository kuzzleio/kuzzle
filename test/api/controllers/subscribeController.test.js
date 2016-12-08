var
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  SubscribeController = require('../../../lib/api/controllers/subscribeController'),
  Request = require('kuzzle-common-objects').Request,
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError;

describe('Test: subscribe controller', () => {
  var
    kuzzle,
    request,
    subscribeController,
    foo = {foo: 'bar'};

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    subscribeController = new SubscribeController(kuzzle);
    request = new Request({index: 'test', collection: 'collection', controller: 'subscribe', body: {}});
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#on', () => {
    it('should throw an error if index is not provided',() => {
      request.input.resource.index = null;

      should(() => {
        subscribeController.on(request);
      }).throw(BadRequestError);
    });

    it('should throw an error if collection is not provided',() => {
      request.input.resource.collection = null;

      should(() => {
        subscribeController.on(request);
      }).throw(BadRequestError);
    });

    it('should throw an error if body is not provided',() => {
      request.input.body = null;

      should(() => {
        subscribeController.on(request);
      }).throw(BadRequestError);
    });

    it('should call the proper hotelClerk method',() => {
      return subscribeController.on(request)
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

      should(() => {
        subscribeController.join(request);
      }).throw(BadRequestError);
    });

    it('should throw an error if roomId is not provided',() => {
      should(() => {
        subscribeController.join(request);
      }).throw(BadRequestError);
    });

    it('should call the proper hotelClerk method',() => {
      request.input.body.roomId = 'foo';

      return subscribeController.join(request)
        .then(result => {
          should(result).be.match(foo);
          should(kuzzle.hotelClerk.join).be.calledOnce();
          should(kuzzle.hotelClerk.join).be.calledWith(request);
        });
    });
  });

  describe('#off', () => {
    it('should throw an error if body is not provided',() => {
      request.input.body = null;

      should(() => {
        subscribeController.off(request);
      }).throw(BadRequestError);
    });

    it('should throw an error if roomId is not provided',() => {
      should(() => {
        subscribeController.off(request);
      }).throw(BadRequestError);
    });

    it('should call the proper hotelClerk method',() => {
      request.input.body.roomId = 'foo';

      return subscribeController.off(request)
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
        subscribeController.count(request);
      }).throw(BadRequestError);
    });

    it('should throw an error if roomId is not provided',() => {
      should(() => {
        subscribeController.count(request);
      }).throw(BadRequestError);
    });

    it('should call the proper hotelClerk method',() => {
      request.input.body.roomId = 'foo';

      return subscribeController.count(request)
        .then(result => {
          should(result).be.match(foo);
          should(kuzzle.hotelClerk.countSubscription).be.calledOnce();
          should(kuzzle.hotelClerk.countSubscription).be.calledWith(request);
        });
    });
  });

  describe('#list', () => {
    it('should call the proper hotelClerk method',() => {
      return subscribeController.list(request)
        .then(result => {
          should(result).be.match(foo);
          should(kuzzle.hotelClerk.listSubscriptions).be.calledOnce();
          should(kuzzle.hotelClerk.listSubscriptions).be.calledWith(request);
        });
    });
  });
});
