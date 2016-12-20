/**
 * This component initializes
 */
var
  should = require('should'),
  rewire = require('rewire'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  KuzzleProxy = rewire('../../../../lib/api/core/entryPoints/kuzzleProxy'),
  Request = require('kuzzle-common-objects').Request,
  RequestContext = require('kuzzle-common-objects').models.RequestContext;

describe('Test: entryPoints/proxy', () => {
  var
    kuzzle,
    entryPoint;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    entryPoint = new KuzzleProxy(kuzzle);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should construct the right object', () => {
    should(entryPoint).have.property('kuzzle');
    should(entryPoint).have.property('channels');
    should(entryPoint.channels).be.empty();

    should(entryPoint.init).be.a.Function();
    should(entryPoint.joinChannel).be.a.Function();
    should(entryPoint.leaveChannel).be.a.Function();
    should(entryPoint.dispatch).be.a.Function();
  });

  it('should init listeners on init call', () => {
    entryPoint.init();
    should(kuzzle.services.list.proxyBroker.listen.calledWith('request')).be.true();
    should(kuzzle.services.list.proxyBroker.listen.calledWith('connection')).be.true();
    should(kuzzle.services.list.proxyBroker.listen.calledWith('disconnect')).be.true();
    should(kuzzle.services.list.proxyBroker.listen.calledWith('error')).be.true();
    should(kuzzle.services.list.proxyBroker.listen.calledWith('httpRequest')).be.true();
    should(kuzzle.services.list.proxyBroker.listen.callCount).be.eql(5);
  });

  it('should send a message on room "joinChannel" on joinChannel call', () => {
    var data = {my: 'data'};

    entryPoint.joinChannel(data);
    should(kuzzle.services.list.proxyBroker.send).be.calledWith('joinChannel', data);
    should(kuzzle.services.list.proxyBroker.send).be.calledOnce();
  });

  it('should send a message on room "leaveChannel" on leaveChannel call', () => {
    var data = {my: 'data'};

    entryPoint.leaveChannel(data);
    should(kuzzle.services.list.proxyBroker.send).be.calledWith('leaveChannel', data);
    should(kuzzle.services.list.proxyBroker.send).be.calledOnce();
  });

  it('should call the funnel execute on event onRequest', () => {
    var data = {data: {}, options: {connectionId: 'myId', protocol: 'socketio'}};

    kuzzle.funnel.execute = sandbox.spy((req, cb) => {
      cb(null, req);
    });

    KuzzleProxy.__get__('onRequest').call(entryPoint, data);

    should(kuzzle.funnel.execute).be.calledOnce();
    should(kuzzle.funnel.execute.firstCall.args[0]).be.instanceOf(Request);
    should(kuzzle.services.list.proxyBroker.send).be.calledWith('response');
  });

  it('should send a message on room "notify" on notify call', () => {
    var data = {my: 'data'};

    entryPoint.dispatch('notify', data);
    should(kuzzle.services.list.proxyBroker.send).be.calledWith('notify', data);
    should(kuzzle.services.list.proxyBroker.send).be.calledOnce();
  });

  it('should send a message on room "broadcast" on broadcast call', () => {
    var data = {my: 'data'};

    entryPoint.dispatch('broadcast', data);
    should(kuzzle.services.list.proxyBroker.send).be.calledWith('broadcast', data);
    should(kuzzle.services.list.proxyBroker.send).be.calledOnce();
  });

  it('should call the router removeConnection on event onDisconnect', () => {
    var data = {data: {}, options: {connectionId: 'myId', protocol: 'socketio'}};

    KuzzleProxy.__get__('onDisconnect').call(entryPoint, data);

    should(kuzzle.router.removeConnection.firstCall.args[0]).be.instanceOf(RequestContext);
  });

  it('should call the router newConnection on event onConnection', () => {
    var data = {data: {}, options: {connectionId: 'myId', protocol: 'socketio'}};

    KuzzleProxy.__get__('onConnection').call(entryPoint, data);

    should(kuzzle.router.newConnection.firstCall.args[0]).be.instanceOf(RequestContext);
  });
});
