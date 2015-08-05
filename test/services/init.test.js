var
  should = require('should'),
  captainsLog = require('captains-log'),
  Kuzzle = require('root-require')('lib/api/Kuzzle');

describe('Test service initialization function', function () {

  var
    kuzzle;

  beforeEach(function () {
    kuzzle = new Kuzzle();
    kuzzle.log = new captainsLog({level: 'silent'});
    kuzzle.start({}, {dummy: true});
  });

  it('should build an internal broker service with correct methods', function () {
    should(kuzzle.services.list.broker).be.an.Object().and.not.be.empty();
    should(kuzzle.services.list.broker.init).be.a.Function();
    should(kuzzle.services.list.broker.start).be.a.Function();
    should(kuzzle.services.list.broker.add).be.a.Function();
    should(kuzzle.services.list.broker.broadcast).be.a.Function();
    should(kuzzle.services.list.broker.listen).be.a.Function();
    should(kuzzle.services.list.broker.listenOnce).be.a.Function();
    should(kuzzle.services.list.broker.close).be.a.Function();
  });

  it('should build a MQ broker service with correct methods', function () {
    should(kuzzle.services.list.mqBroker).be.an.Object().and.not.be.empty();
    should(kuzzle.services.list.mqBroker.init).be.a.Function();
    should(kuzzle.services.list.mqBroker.add).be.a.Function();
    should(kuzzle.services.list.mqBroker.addExchange).be.a.Function();
    should(kuzzle.services.list.mqBroker.listenExchange).be.a.Function();
    should(kuzzle.services.list.mqBroker.replyTo).be.a.Function();
    should(kuzzle.services.list.mqBroker.listen).be.a.Function();
    should(kuzzle.services.list.mqBroker.listenOnce).be.a.Function();
    should(kuzzle.services.list.mqBroker.close).be.a.Function();
  });
  
  it('should build a readEngine service with correct methods', function () {
    should(kuzzle.services.list.readEngine).be.an.Object();
    should(kuzzle.services.list.readEngine.search).be.a.Function();
    should(kuzzle.services.list.readEngine.get).be.a.Function();
  });

  it('should build a writeEngine service with correct methods', function () {
    should(kuzzle.services.list.writeEngine).be.an.Object();
    should(kuzzle.services.list.writeEngine.create).be.a.Function();
    should(kuzzle.services.list.writeEngine.update).be.a.Function();
    should(kuzzle.services.list.writeEngine.deleteByQuery).be.a.Function();
    should(kuzzle.services.list.writeEngine.deleteCollection).be.a.Function();
    should(kuzzle.services.list.writeEngine.import).be.a.Function();
  });

  it('should build a cache service', function () {
     should(kuzzle.services.list.notificationCache).be.an.Object();
     should(kuzzle.services.list.notificationCache.add).be.a.Function();
     should(kuzzle.services.list.notificationCache.remove).be.a.Function();
     should(kuzzle.services.list.notificationCache.search).be.a.Function();
  });

  it('should build a profiling service', function () {
    should(kuzzle.services.list.profiling).be.an.Object();
    should(kuzzle.services.list.profiling.addHooks).be.a.Function();
    should(kuzzle.services.list.profiling.toggle).be.a.Function();
    should(kuzzle.services.list.profiling.startLog).be.a.Function();
    should(kuzzle.services.list.profiling.stopLog).be.a.Function();
  });

});