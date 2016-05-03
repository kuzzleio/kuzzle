var
  should = require('should'),
  params = require('rc')('kuzzle'),
  q = require('q'),
  sinon = require('sinon'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  ResponseObject = require.main.require('lib/api/core/models/responseObject');

require('sinon-as-promised')(q.Promise);

describe('Test: subscribe controller', function () {
  var
    kuzzle,
    sandbox,
    requestObject;

  before(() => {
    kuzzle = new Kuzzle();
    return kuzzle.start(params, {dummy: true});
  });

  beforeEach(() => {
    requestObject = new RequestObject({index: 'test', collection: 'collection', controller: 'subscribe'}, {}, 'unit-test');
    sandbox = sinon.sandbox.create();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#on', () => {
    it('should forward new subscriptions to the hotelClerk core component', function () {
      sandbox.stub(kuzzle.hotelClerk, 'addSubscription').resolves();

      return kuzzle.funnel.controllers.subscribe.on(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.hotelClerk, 'addSubscription').rejects();
      return should(kuzzle.funnel.controllers.subscribe.on(requestObject)).be.rejectedWith(ResponseObject);
    });
  });

  describe('#off', () => {
    it('should forward unsubscribes queries to the hotelClerk core component', function () {
      sandbox.stub(kuzzle.hotelClerk, 'removeSubscription').resolves();
      return kuzzle.funnel.controllers.subscribe.off(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.hotelClerk, 'removeSubscription').rejects();
      return should(kuzzle.funnel.controllers.subscribe.off(requestObject)).be.rejectedWith(ResponseObject);
    });
  });

  describe('#count', () => {
    it('should forward subscription counts queries to the hotelClerk core component', function () {
      sandbox.stub(kuzzle.hotelClerk, 'countSubscription').resolves();
      return kuzzle.funnel.controllers.subscribe.count(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.hotelClerk, 'countSubscription').rejects();
      return should(kuzzle.funnel.controllers.subscribe.count(requestObject)).be.rejectedWith(ResponseObject);
    });
  });

  describe('#list', function () {
    it('should trigger a hook and return a promise', function (done) {
      this.timeout(50);
      sandbox.stub(kuzzle.hotelClerk, 'listSubscriptions').resolves();

      kuzzle.once('subscription:beforeList', () => done());
      kuzzle.funnel.controllers.subscribe.list(requestObject);
    });

    it('should forward subscription list query to the hotelClerk core component', function () {
      sandbox.stub(kuzzle.hotelClerk, 'listSubscriptions').resolves();
      return kuzzle.funnel.controllers.subscribe.list(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.hotelClerk, 'listSubscriptions').rejects();
      return should(kuzzle.funnel.controllers.subscribe.list(requestObject)).be.rejectedWith(ResponseObject);
    });
  });

  describe('#join', function () {
    it('should forward subscription join query to the hotelClerk core component', function () {
      sandbox.stub(kuzzle.hotelClerk, 'join').resolves();
      return kuzzle.funnel.controllers.subscribe.join(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      sandbox.stub(kuzzle.hotelClerk, 'join').rejects();
      return should(kuzzle.funnel.controllers.subscribe.join(requestObject)).be.rejectedWith(ResponseObject);
    });

    it('should trigger a hook and return a promise', function (done) {
      this.timeout(50);
      sandbox.stub(kuzzle.hotelClerk, 'join').resolves();
      kuzzle.once('subscription:beforeJoin', () => done());
      kuzzle.funnel.controllers.subscribe.join(requestObject);
    });
  });
});
