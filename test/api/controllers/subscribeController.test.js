var
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Kuzzle = require.main.require('lib/api/kuzzle'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  ResponseObject = require.main.require('kuzzle-common-objects').Models.responseObject;

describe('Test: subscribe controller', () => {
  var
    kuzzle,
    requestObject;

  before(() => {
    kuzzle = new Kuzzle();
  });

  beforeEach(() => {
    requestObject = new RequestObject({index: 'test', collection: 'collection', controller: 'subscribe'}, {}, 'unit-test');
    sandbox.stub(kuzzle.internalEngine, 'get').resolves({});
    return kuzzle.services.init({whitelist: []})
      .then(() => kuzzle.funnel.init());
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#on', () => {
    it('should forward new subscriptions to the hotelClerk core component', () => {
      sandbox.stub(kuzzle.hotelClerk, 'addSubscription').resolves();

      return kuzzle.funnel.controllers.subscribe.on(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      var error = new Error('Mocked error');
      sandbox.stub(kuzzle.hotelClerk, 'addSubscription').rejects(error);
      return should(kuzzle.funnel.controllers.subscribe.on(requestObject)).be.rejectedWith(error);
    });
  });

  describe('#off', () => {
    it('should forward unsubscribes queries to the hotelClerk core component', () => {
      sandbox.stub(kuzzle.hotelClerk, 'removeSubscription').resolves();
      return kuzzle.funnel.controllers.subscribe.off(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      var error = new Error('Mocked error');
      sandbox.stub(kuzzle.hotelClerk, 'removeSubscription').rejects(error);
      return should(kuzzle.funnel.controllers.subscribe.off(requestObject)).be.rejectedWith(error);
    });
  });

  describe('#count', () => {
    it('should forward subscription counts queries to the hotelClerk core component', () => {
      sandbox.stub(kuzzle.hotelClerk, 'countSubscription').resolves();
      return kuzzle.funnel.controllers.subscribe.count(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      var error = new Error('Mocked error');
      sandbox.stub(kuzzle.hotelClerk, 'countSubscription').rejects(error);
      return should(kuzzle.funnel.controllers.subscribe.count(requestObject)).be.rejectedWith(error);
    });
  });

  describe('#list', () => {
    it('should trigger a hook and return a promise', function (done) {
      this.timeout(50);
      sandbox.stub(kuzzle.hotelClerk, 'listSubscriptions').resolves();

      kuzzle.once('subscription:beforeList', () => done());
      kuzzle.funnel.controllers.subscribe.list(requestObject);
    });

    it('should forward subscription list query to the hotelClerk core component', () => {
      sandbox.stub(kuzzle.hotelClerk, 'listSubscriptions').resolves();
      return kuzzle.funnel.controllers.subscribe.list(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      var error = new Error('Mocked error');
      sandbox.stub(kuzzle.hotelClerk, 'listSubscriptions').rejects(error);
      return should(kuzzle.funnel.controllers.subscribe.list(requestObject)).be.rejectedWith(error);
    });
  });

  describe('#join', () => {
    it('should forward subscription join query to the hotelClerk core component', () => {
      sandbox.stub(kuzzle.hotelClerk, 'join').resolves();
      return kuzzle.funnel.controllers.subscribe.join(requestObject)
        .then(response => should(response).be.instanceOf(ResponseObject));
    });

    it('should reject with a response object in case of error', () => {
      var error = new Error('Mocked error');
      sandbox.stub(kuzzle.hotelClerk, 'join').rejects(error);
      return should(kuzzle.funnel.controllers.subscribe.join(requestObject)).be.rejectedWith(error);
    });

    it('should trigger a hook and return a promise', function (done) {
      this.timeout(50);
      sandbox.stub(kuzzle.hotelClerk, 'join').resolves();
      kuzzle.once('subscription:beforeJoin', () => done());
      kuzzle.funnel.controllers.subscribe.join(requestObject);
    });
  });
});
