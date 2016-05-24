var
  should = require('should'),
  params = require('rc')('kuzzle'),
  sinon = require('sinon'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  sandbox = sinon.sandbox.create();

describe('Test service initialization function', function () {

  var
    kuzzle;

  beforeEach(() => {
    kuzzle = new Kuzzle();
    return kuzzle.start(params, {dummy: true})
      .then(() => {
        kuzzle.removeAllListeners();

        kuzzle.internalEngine.client.transport = {};
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should build an internal broker service with correct methods', function () {
    return kuzzle.start(params, {dummy: true})
      .then(() => {
        should(kuzzle.services.list.broker).be.an.Object().and.not.be.empty();
        should(kuzzle.services.list.broker.init).be.a.Function();
        should(kuzzle.services.list.broker.send).be.a.Function();
        should(kuzzle.services.list.broker.broadcast).be.a.Function();
        should(kuzzle.services.list.broker.listen).be.a.Function();
        should(kuzzle.services.list.broker.unsubscribe).be.a.Function();
        should(kuzzle.services.list.broker.close).be.a.Function();
      });
  });

  it('should build a MQ broker service with correct methods', function () {
    return kuzzle.start(params, {dummy: true})
      .then(() => {
        should(kuzzle.services.list.mqBroker).be.an.Object().and.not.be.empty();
        should(kuzzle.services.list.mqBroker.init).be.a.Function();
        should(kuzzle.services.list.mqBroker.toggle).be.a.Function();
        should(kuzzle.services.list.mqBroker.add).be.a.Function();
        should(kuzzle.services.list.mqBroker.addExchange).be.a.Function();
        should(kuzzle.services.list.mqBroker.listenExchange).be.a.Function();
        should(kuzzle.services.list.mqBroker.replyTo).be.a.Function();
        should(kuzzle.services.list.mqBroker.listen).be.a.Function();
        should(kuzzle.services.list.mqBroker.listenOnce).be.a.Function();
        should(kuzzle.services.list.mqBroker.close).be.a.Function();
      });
  });
  
  it('should build a readEngine service with correct methods', function () {
    return kuzzle.start(params, {dummy: true})
      .then(() => {
        should(kuzzle.services.list.readEngine).be.an.Object();
        should(kuzzle.services.list.readEngine.init).be.a.Function();
        should(kuzzle.services.list.readEngine.search).be.a.Function();
        should(kuzzle.services.list.readEngine.get).be.a.Function();
      });
  });

  it('should build a writeEngine service with correct methods', function () {
    return kuzzle.start(params, {dummy: true})
      .then(() => {
        should(kuzzle.services.list.writeEngine).be.an.Object();
        should(kuzzle.services.list.writeEngine.init).be.a.Function();
        should(kuzzle.services.list.writeEngine.create).be.a.Function();
        should(kuzzle.services.list.writeEngine.update).be.a.Function();
        should(kuzzle.services.list.writeEngine.deleteByQuery).be.a.Function();
        should(kuzzle.services.list.writeEngine.import).be.a.Function();
      });
  });

  it('should build a cache service', function () {
    return kuzzle.start(params, {dummy: true})
      .then(() => {
        should(kuzzle.services.list.notificationCache).be.an.Object();
        should(kuzzle.services.list.notificationCache.add).be.a.Function();
        should(kuzzle.services.list.notificationCache.remove).be.a.Function();
        should(kuzzle.services.list.notificationCache.search).be.a.Function();
      });
  });

  it('should not init services in blacklist', function () {
    var spy = sandbox.stub(kuzzle.internalEngine, 'get').resolves({});

    kuzzle.config = {
      services: {
        writeEngine: 'elasticsearch'
      }
    };

    return kuzzle.services.init({blacklist: ['writeEngine']})
      .then(() => {
        should(kuzzle.services.list.writeEngine.client).be.null();
        should(spy.calledOnce).be.true();
      });

  });

  it('should throw error if service file doesn\'t exist', function (done) {
    kuzzle.config = {
      services: {
        writeEngine: 'foo'
      }
    };

    try {
      kuzzle.services.init();
      done(new Error());
    }
    catch (e) {
      done();
    }

  });

});
