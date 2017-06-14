/**
 * This component initializes
 */
const
  should = require('should'),
  rewire = require('rewire'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  KuzzleProxy = rewire('../../../../lib/api/core/entryPoints/kuzzleProxy'),
  Request = require('kuzzle-common-objects').Request,
  RequestContext = require('kuzzle-common-objects').models.RequestContext;

describe('Test: entryPoints/proxy', () => {
  let
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
    const data = {my: 'data'};

    entryPoint.joinChannel(data);
    should(kuzzle.services.list.proxyBroker.send).be.calledWith('joinChannel', data);
    should(kuzzle.services.list.proxyBroker.send).be.calledOnce();
  });

  it('should send a message on room "leaveChannel" on leaveChannel call', () => {
    const data = {my: 'data'};

    entryPoint.leaveChannel(data);
    should(kuzzle.services.list.proxyBroker.send).be.calledWith('leaveChannel', data);
    should(kuzzle.services.list.proxyBroker.send).be.calledOnce();
  });

  it('should send a message on room "notify" on notify call', () => {
    const data = {my: 'data'};

    entryPoint.dispatch('notify', data);
    should(kuzzle.services.list.proxyBroker.send).be.calledWith('notify', data);
    should(kuzzle.services.list.proxyBroker.send).be.calledOnce();
  });

  it('should send a message on room "broadcast" on broadcast call', () => {
    const data = {my: 'data'};

    entryPoint.dispatch('broadcast', data);
    should(kuzzle.services.list.proxyBroker.send).be.calledWith('broadcast', data);
    should(kuzzle.services.list.proxyBroker.send).be.calledOnce();
  });

  it('should call the router removeConnection on event onDisconnect', () => {
    const data = {data: {}, options: {connectionId: 'myId', protocol: 'socketio'}};

    KuzzleProxy.__get__('onDisconnect').call(entryPoint, data);

    should(kuzzle.router.removeConnection.firstCall.args[0]).be.instanceOf(RequestContext);
  });

  it('should call the router newConnection on event onConnection', () => {
    const data = {data: {}, options: {connectionId: 'myId', protocol: 'socketio'}};

    KuzzleProxy.__get__('onConnection').call(entryPoint, data);

    should(kuzzle.router.newConnection.firstCall.args[0]).be.instanceOf(RequestContext);
  });

  describe('#onRequest', () => {
    it('should execute the API call through the funnel controller', () => {
      const data = {
        data: {requestId: 'foobar', timestamp: 12345}, 
        options: {connectionId: 'myId', protocol: 'socketio'}
      };
      let request;

      kuzzle.funnel.execute = sandbox.spy((req, cb) => {
        request = req;
        cb(null, req);
      });

      KuzzleProxy.__get__('onRequest').call(entryPoint, data);

      should(kuzzle.funnel.execute).be.calledOnce();
      should(kuzzle.funnel.execute.firstCall.args[0]).be.instanceOf(Request);
      should(kuzzle.services.list.proxyBroker.send).be.calledOnce();
      const brokerArgs = kuzzle.services.list.proxyBroker.send.firstCall.args;

      should(brokerArgs.length).be.eql(2);
      should(brokerArgs[0]).be.eql('response');
      should(brokerArgs[1]).be.an.Object().and.match(request.response.toJSON());
    });

    it('should send back to the proxy a response with the same id than the one received', () => {
      const data = {
        data: {requestId: 'foobar', timestamp: 12345}, 
        options: {connectionId: 'myId', protocol: 'socketio'}
      };
      let request;

      kuzzle.funnel.execute = sandbox.spy((req, cb) => {
        request = req;
        cb(null, new Request({}));
      });

      KuzzleProxy.__get__('onRequest').call(entryPoint, data);

      should(kuzzle.funnel.execute).be.calledOnce();
      should(kuzzle.funnel.execute.firstCall.args[0]).be.instanceOf(Request);
      should(kuzzle.services.list.proxyBroker.send).be.calledOnce();
      const brokerArgs = kuzzle.services.list.proxyBroker.send.firstCall.args;

      should(brokerArgs.length).be.eql(2);
      should(brokerArgs[0]).be.eql('response');
      should(brokerArgs[1].requestId).be.eql(request.id);
      should(brokerArgs[1].content.requestId).be.eql(request.id);
    });
  });

  describe('#onHttpRequest', () => {
    it('should execute the API call through the HTTP router', () => {
      const message = {
        requestId: 'foobar'
      };

      kuzzle.router.router.route = sandbox.spy((msg, cb) => {
        should(msg).be.eql(message);
        cb(new Request(message));
      });

      KuzzleProxy.__get__('onHttpRequest').call(entryPoint, message);

      should(kuzzle.router.router.route).be.calledOnce();
      should(kuzzle.router.router.route.firstCall.args[0]).be.eql(message);
      should(kuzzle.services.list.proxyBroker.send).be.calledOnce();
      const brokerArgs = kuzzle.services.list.proxyBroker.send.firstCall.args;

      should(brokerArgs.length).be.eql(2);
      should(brokerArgs[0]).be.eql('httpResponse');
      should(brokerArgs[1]).be.an.Object();
    });

    it('should return to the proxy a response with the same id than the provided message', () => {
      const message = {
        requestId: 'foobar'
      };

      kuzzle.router.router.route = sandbox.spy((msg, cb) => {
        should(msg).be.eql(message);
        cb(new Request({requestId: 'new and useless id'}));
      });

      KuzzleProxy.__get__('onHttpRequest').call(entryPoint, message);

      should(kuzzle.router.router.route).be.calledOnce();
      should(kuzzle.router.router.route.firstCall.args[0]).be.eql(message);
      should(kuzzle.services.list.proxyBroker.send).be.calledOnce();
      const brokerArgs = kuzzle.services.list.proxyBroker.send.firstCall.args;

      should(brokerArgs.length).be.eql(2);
      should(brokerArgs[0]).be.eql('httpResponse');
      should(brokerArgs[1]).be.an.Object();
      should(brokerArgs[1].requestId).be.eql(message.requestId);
      should(brokerArgs[1].content.requestId).be.eql(message.requestId);
    });
  });
});
