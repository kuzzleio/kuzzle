const
  Bluebird = require('bluebird'),
  should = require('should'),
  sinon = require('sinon'),
  KuzzleMock = require('../../../../mocks/kuzzle.mock'),
  ProxyEntryPoint = require('../../../../../lib/api/core/entrypoints/proxy'),
  Request = require('kuzzle-common-objects').Request;

describe('/lib/api/core/entrypoints/proxy', () => {
  let
    clock,
    kuzzle,
    entrypoint;

  before(() => {
    clock = sinon.useFakeTimers();
  });

  after(() => {
    clock.restore();
  });

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    entrypoint = new ProxyEntryPoint(kuzzle);

    entrypoint.proxy = {
      init: sinon.stub().returns(Bluebird.resolve()),
      listen: sinon.spy(),
      onConnectHandlers: [],
      send: sinon.spy()
    };
  });

  describe('init', () => {
    it('should attach events to the the ws client', () => {
      entrypoint.onRequest = sinon.spy();
      entrypoint.onConnection = sinon.spy();
      entrypoint.onDisconnect = sinon.spy();
      entrypoint.onHttpRequest = sinon.spy();

      return entrypoint.init()
        .then(() => {
          const handlers = {};

          for (let i = 0; i < entrypoint.proxy.listen.callCount; i++) {
            const
              args = entrypoint.proxy.listen.getCall(i).args,
              event = args[0],
              handler = args[1];
            handlers[event] = handler;
          }

          handlers.request('test');
          should(entrypoint.onRequest)
            .be.calledOnce();

          handlers.connection('test');
          should(entrypoint.onConnection)
            .be.calledOnce()
            .be.calledWith('test');

          handlers.disconnect('test');
          should(entrypoint.onDisconnect)
            .be.calledOnce();

          handlers.error('test');
          should(entrypoint.onDisconnect)
            .be.calledTwice();

          handlers.httpRequest('test');
          should(entrypoint.onHttpRequest)
            .be.calledOnce()
            .be.calledWith('test');

          should(entrypoint.proxy.send)
            .be.calledOnce()
            .be.calledWith('ready');

          {
            // reconnect handler
            const connH = entrypoint.proxy.onConnectHandlers[0];
            connH();
            clock.tick(entrypoint.config.resendClientListDelay + 10);

            should(entrypoint.proxy.send)
              .be.calledTwice()
              .be.calledWith('ready');
          }
        });
    });
  });

  describe('#joinChannel', () => {
    it('should forward the request to the ws client', () => {
      entrypoint.joinChannel('channel', 'connectionId');
      should(entrypoint.proxy.send)
        .be.calledOnce()
        .be.calledWith('joinChannel', {
          channel: 'channel',
          connectionId: 'connectionId'
        });
    });
  });

  describe('#leaveChannel', () => {
    it('should forward the request to the ws client', () => {
      entrypoint.leaveChannel('channel', 'connectionId');
      should(entrypoint.proxy.send)
        .be.calledOnce()
        .be.calledWith('leaveChannel', {
          channel: 'channel',
          connectionId: 'connectionId'
        });
    });
  });

  describe('#dispatch', () => {
    it('should forward the request to the ws client', () => {
      entrypoint.dispatch('event', 'data');
      should(entrypoint.proxy.send)
        .be.calledOnce()
        .be.calledWith('event', 'data');
    });
  });

  describe('#onRequest', () => {
    it('should send the response from the funnel back', () => {
      entrypoint.onRequest({
        data: {
          foo: 'bar'
        },
        options: {
          connectionId: 'connectionId'
        }
      });

      const cb = kuzzle.funnel.execute.firstCall.args[1];
      const result = kuzzle.funnel.execute.firstCall.args[0];
      result.setResult('content', {
        status: 444
      });
      cb(null, result);

      should(entrypoint.proxy.send)
        .be.calledOnce()
        .be.calledWith('response', result.response.toJSON());
    });

    it('should force the response request id to the request one', () => {
      entrypoint.onRequest({
        data: {
          foo: 'bar'
        },
        options: {
          connectionId: 'connectionId'
        }
      });

      const cb = kuzzle.funnel.execute.firstCall.args[1];
      const request = kuzzle.funnel.execute.firstCall.args[0];
      const result = new Request({});


      cb(null, result);
      const sent = entrypoint.proxy.send.firstCall.args[1];
      should(sent.requestId)
        .eql(request.id);
    });
  });

  describe('#onConnection', () => {
    it('should register the new connection in Kuzzle router', () => {
      entrypoint.onConnection({connectionId: 'test'});
      should(kuzzle.router.newConnection)
        .be.calledOnce()
        .be.calledWithMatch({connectionId: 'test'});
    });
  });

  describe('#onDisconnect', () => {
    it('should deregister the connection from Kuzzle router', () => {
      entrypoint.onDisconnect({connectionId: 'test'});
      should(kuzzle.router.removeConnection)
        .be.calledOnce()
        .be.calledWithMatch({connectionId: 'test'});
    });
  });

  describe('#onHttpRequest', () =>{
    it('should respond Kuzzle http router back to the client', () => {
      entrypoint.onHttpRequest({
        requestId: 'requestId'
      });

      const cb = kuzzle.router.http.route.firstCall.args[1];
      const result = new Request({});
      result.setResult('content');

      cb(result);

      should(entrypoint.proxy.send.firstCall.args[1])
        .match({ raw: false,
          status: 200,
          requestId: 'requestId',
          content: {
            requestId: 'requestId',
            status: 200,
            error: null,
            controller: null,
            action: null,
            collection: null,
            index: null,
            volatile: null,
            result: 'content'
          }
        });
    });
  });

});
