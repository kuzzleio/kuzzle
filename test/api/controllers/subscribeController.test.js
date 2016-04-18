var
  should = require('should'),
  params = require('rc')('kuzzle'),
  q = require('q'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject');

/*
 * Since we're sending voluntarily false requests, we expect most of these
 * calls to fail.
 */
describe('Test: subscribe controller', function () {
  var
    kuzzle,
    anonymousToken,
    context,
    requestObject,
    error,
    mockFunction,
    mockResponse;

  before(function () {
    mockFunction = () => {
      if (error) {
        return q.reject(new Error('foobar'));
      }

      return q(mockResponse);
    };

    context = {};
    kuzzle = new Kuzzle();
    return kuzzle.start(params, {dummy: true})
      .then(function () {
        return kuzzle.repositories.token.anonymous();
      })
      .then(function (token) {
        anonymousToken = token;
      });
  });

  beforeEach(() => {
    error = false;
    mockResponse = {};
    requestObject = new RequestObject({index: 'test', collection: 'collection', controller: 'subscribe'}, {}, 'unit-test');
  });

  describe('#on', () => {
    before(() => {
      kuzzle.hotelClerk.addSubscription = mockFunction;
    });

    it('should forward new subscriptions to the hotelClerk core component', function () {
      return kuzzle.funnel.controllers.subscribe.on(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      error = true;
      return should(kuzzle.funnel.controllers.subscribe.on(requestObject)).be.rejectedWith(ResponseObject);
    });
  });

  describe('#off', () => {
    before(() => {
      kuzzle.hotelClerk.removeSubscription = mockFunction;
    });

    it('should forward unsubscribes queries to the hotelClerk core component', function () {
      return kuzzle.funnel.controllers.subscribe.off(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      error = true;
      return should(kuzzle.funnel.controllers.subscribe.off(requestObject)).be.rejectedWith(ResponseObject);
    });
  });

  describe('#count', () => {
    before(() => {
      kuzzle.hotelClerk.countSubscription = mockFunction;
    });

    it('should forward subscription counts queries to the hotelClerk core component', function () {
      return kuzzle.funnel.controllers.subscribe.count(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      error = true;
      return should(kuzzle.funnel.controllers.subscribe.count(requestObject)).be.rejectedWith(ResponseObject);
    });
  });

  describe('#list', function () {
    before(() => {
      kuzzle.hotelClerk.listSubscriptions = mockFunction;
    });

    it('should trigger a hook and return a promise', function (done) {
      this.timeout(50);

      kuzzle.once('subscription:list', () => done());
      kuzzle.funnel.controllers.subscribe.list(requestObject);
    });

    it('should forward subscription list query to the hotelClerk core component', function () {
      return kuzzle.funnel.controllers.subscribe.list(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      error = true;
      return should(kuzzle.funnel.controllers.subscribe.list(requestObject)).be.rejectedWith(ResponseObject);
    });
  });

  describe('#join', function () {
    before(() => {
      kuzzle.hotelClerk.join = mockFunction;
    });

    it('should forward subscription join query to the hotelClerk core component', function () {
      return kuzzle.funnel.controllers.subscribe.join(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      error = true;
      return should(kuzzle.funnel.controllers.subscribe.join(requestObject)).be.rejectedWith(ResponseObject);
    });

    it('should trigger a hook and return a promise', function (done) {
      this.timeout(50);
      kuzzle.once('subscription:join', () => done());
      kuzzle.funnel.controllers.subscribe.join(requestObject);
    });
  });
});
