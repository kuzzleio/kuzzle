var
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Kuzzle = require('../../../lib/api/kuzzle'),
  Request = require('kuzzle-common-objects').Request;

describe('Test: subscribe controller', () => {
  var
    kuzzle,
    requestObject;

  before(() => {
    kuzzle = new Kuzzle();
  });

  beforeEach(() => {
    requestObject = new Request({index: 'test', collection: 'collection', controller: 'subscribe'}, {}, 'unit-test');
    sandbox.stub(kuzzle.internalEngine, 'get').returns(Promise.resolve({}));
    return kuzzle.services.init({whitelist: []})
      .then(() => kuzzle.funnel.init());
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#on', () => {
    it('should forward new subscriptions to the hotelClerk core component', () => {
      sandbox.stub(kuzzle.hotelClerk, 'addSubscription').returns(Promise.resolve());

      return kuzzle.funnel.controllers.subscribe.on(requestObject, {})
        .then(response => {
          // TODO test response format
          should(response.userContext).be.instanceOf(Object);
        });
    });

    it('should reject with a response object in case of error', () => {
      var error = new Error('Mocked error');
      sandbox.stub(kuzzle.hotelClerk, 'addSubscription').returns(Promise.reject(error));
      return should(kuzzle.funnel.controllers.subscribe.on(requestObject, {})).be.rejectedWith(error);
    });
  });

  describe('#off', () => {
    it('should forward unsubscribes queries to the hotelClerk core component', () => {
      sandbox.stub(kuzzle.hotelClerk, 'removeSubscription').returns(Promise.resolve());
      return kuzzle.funnel.controllers.subscribe.off(requestObject, {})
        .then(response => {
          // TODO test response format
          should(response.userContext).be.instanceOf(Object);
        });
    });

    it('should reject with a response object in case of error', () => {
      var error = new Error('Mocked error');
      sandbox.stub(kuzzle.hotelClerk, 'removeSubscription').returns(Promise.reject(error));
      return should(kuzzle.funnel.controllers.subscribe.off(requestObject, {})).be.rejectedWith(error);
    });
  });

  describe('#count', () => {
    it('should forward subscription counts queries to the hotelClerk core component', () => {
      sandbox.stub(kuzzle.hotelClerk, 'countSubscription').returns(Promise.resolve());
      return kuzzle.funnel.controllers.subscribe.count(requestObject, {})
        .then(response => {
          // TODO test response format
          should(response.userContext).be.instanceOf(Object);
        });
    });

    it('should reject with a response object in case of error', () => {
      var error = new Error('Mocked error');
      sandbox.stub(kuzzle.hotelClerk, 'countSubscription').returns(Promise.reject(error));
      return should(kuzzle.funnel.controllers.subscribe.count(requestObject, {})).be.rejectedWith(error);
    });
  });

  describe('#list', () => {
    it('should trigger a hook and return a promise', function (done) {
      this.timeout(50);
      sandbox.stub(kuzzle.hotelClerk, 'listSubscriptions').returns(Promise.resolve());

      kuzzle.once('subscription:beforeList', () => done());
      kuzzle.funnel.controllers.subscribe.list(requestObject, {});
    });

    it('should forward subscription list query to the hotelClerk core component', () => {
      sandbox.stub(kuzzle.hotelClerk, 'listSubscriptions').returns(Promise.resolve());
      return kuzzle.funnel.controllers.subscribe.list(requestObject, {})
        .then(response => {
          // TODO test response format
          should(response.userContext).be.instanceOf(Object);
        });
    });

    it('should reject with a response object in case of error', () => {
      var error = new Error('Mocked error');
      sandbox.stub(kuzzle.hotelClerk, 'listSubscriptions').returns(Promise.reject(error));
      return should(kuzzle.funnel.controllers.subscribe.list(requestObject, {})).be.rejectedWith(error);
    });
  });

  describe('#join', () => {
    it('should forward subscription join query to the hotelClerk core component', () => {
      sandbox.stub(kuzzle.hotelClerk, 'join').returns(Promise.resolve());
      return kuzzle.funnel.controllers.subscribe.join(requestObject, {})
        .then(response => {
          // TODO test response format
          should(response.userContext).be.instanceOf(Object);
        });
    });

    it('should reject with a response object in case of error', () => {
      var error = new Error('Mocked error');
      sandbox.stub(kuzzle.hotelClerk, 'join').returns(Promise.reject(error));
      return should(kuzzle.funnel.controllers.subscribe.join(requestObject, {})).be.rejectedWith(error);
    });

    it('should trigger a hook and return a promise', function (done) {
      this.timeout(50);
      sandbox.stub(kuzzle.hotelClerk, 'join').returns(Promise.resolve());
      kuzzle.once('subscription:beforeJoin', () => done());
      kuzzle.funnel.controllers.subscribe.join(requestObject, {});
    });
  });
});
