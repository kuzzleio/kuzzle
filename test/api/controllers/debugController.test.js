'use strict';

const should = require('should');
const sinon = require('sinon');

const {
  Request,
  PreconditionError,
  InternalError,
} = require('../../../index');
const { DebugController } = require('../../../lib/api/controllers');
const KuzzleMock = require('../../mocks/kuzzle.mock');
const DebugModuleMock = require('../../mocks/debugModule.mock');


describe('Test: debug controller', () => {
  let debugController;
  let kuzzle;

  beforeEach(async () => {
    kuzzle = new KuzzleMock();
    debugController = new DebugController();

    await debugController.init();
  });

  describe('#events', () => {
    it('should listen to events from inspectorNotification and send notification to websocket connections listening', async () => {
      debugController.debuggerStatus = true;
      
      debugController.notifyGlobalListeners = sinon.stub().resolves();

      let resolve;
      const promise = new Promise((res) => {
        resolve = res;
      });
      debugController.notifyConnection = sinon.stub().callsFake(async () => {
        resolve();
      });
      debugController.events.set('notification', new Set(['foo']));

      debugController.inspector.emit('inspectorNotification', {
        method: 'notification',
        foo: 'bar'
      });

      await promise;

      await should(debugController.notifyGlobalListeners)
        .be.calledWith(
          'notification',
          {
            method: 'notification',
            foo: 'bar'
          });
      
      await should(debugController.notifyConnection)
        .be.calledOnce()
        .and.be.calledWith(
          'foo',
          'kuzzle-debugger-event',
          {
            event: 'notification',
            result: {
              method: 'notification',
              foo: 'bar'
            }
          }
        );
    });

    it('should listen to events from DebugModules and send notification to websocket connections listening', async () => {
      const debugModule = new DebugModuleMock();
      debugController.modules = [
        debugModule
      ];
      sinon.stub(debugController.inspector, 'connect').returns();
      debugController.notifyGlobalListeners = sinon.stub().resolves();

      await debugController.enable();

      let resolve;
      const promise = new Promise((res) => {
        resolve = res;
      });
      debugController.notifyConnection = sinon.stub().callsFake(async () => {
        resolve();
      });
      debugController.events.set('Kuzzle.DebugModuleMock.event_foo', new Set(['foo']));

      debugModule.emit('event_foo', {
        foo: 'bar'
      });

      await promise;

      await should(debugController.notifyGlobalListeners)
        .be.calledWith(
          'Kuzzle.DebugModuleMock.event_foo',
          {
            foo: 'bar'
          });
      
      await should(debugController.notifyConnection)
        .be.calledOnce()
        .and.be.calledWith(
          'foo',
          'kuzzle-debugger-event',
          {
            event: 'Kuzzle.DebugModuleMock.event_foo',
            result: {
              foo: 'bar'
            }
          }
        );
    });
  });


  describe('#enable', () => {
    it('should connect the debugger', async () => {
      sinon.stub(debugController.inspector, 'connect').returns();
      await debugController.enable();

      await should(debugController.inspector.connect).be.calledOnce();

      should(debugController.debuggerStatus).be.true();
    });

    it('should only connect the debugger once', async () => {
      sinon.stub(debugController.inspector, 'connect').returns();

      await debugController.enable();
      await debugController.enable();

      await should(debugController.inspector.connect).be.calledOnce();
    });

    it('should init debug modules and register events', async () => {
      sinon.stub(debugController.inspector, 'connect').returns();

      const debugModule = new DebugModuleMock();
      sinon.spy(debugModule, 'on');

      debugController.modules = [
        debugModule
      ];

      await debugController.enable();

      await should(debugModule.init)
        .be.calledOnce()
        .and.be.calledWith(debugController.inspector);

      await should(debugController.kuzzlePostMethods.size).be.eql(1);

      await should(debugModule.on)
        .be.calledOnce()
        .and.be.calledWithMatch('event_foo');
    });

    it('should throw if a DebugModule method is not implemented', async () => {
      sinon.stub(debugController.inspector, 'connect').returns();
      const debugModule = new DebugModuleMock();
      debugModule.methods = ['bar'];
      debugController.modules = [
        debugModule
      ];

      await should(debugController.enable()).be.rejectedWith('Missing implementation of method "bar" inside DebugModule "DebugModuleMock"');
    });
  });

  describe('#disable', () => {
    it('should do nothing if the debugger is not enabled', async () => {
      sinon.stub(debugController.inspector, 'disconnect').returns();

      debugController.debuggerStatus = false;

      await debugController.disable();

      await should(debugController.inspector.disconnect).not.be.called();
    });

    it('should disconnect the debugger', async () => {
      sinon.stub(debugController.inspector, 'disconnect').returns();

      debugController.debuggerStatus = true;

      await debugController.disable();

      await should(debugController.inspector.disconnect).be.calledOnce();

      await should(debugController.debuggerStatus).be.false();
    });

    it('should clear the event map and post methods map', async () => {
      sinon.stub(debugController.inspector, 'disconnect').returns();

      debugController.debuggerStatus = true;
      const clearEventStub = sinon.stub(debugController.events, 'clear').returns();
      const clearKuzzlePostMethodsStub = sinon.stub(debugController.kuzzlePostMethods, 'clear').returns();

      await debugController.disable();
      await should(clearEventStub).be.calledOnce();
      await should(clearKuzzlePostMethodsStub).be.calledOnce();
    });

    it('should call the cleanup routine of DebugModules', async () => {
      sinon.stub(debugController.inspector, 'disconnect').returns();

      debugController.debuggerStatus = true;
      const debugModule = new DebugModuleMock();
      debugController.modules = [
        debugModule
      ];
      await debugController.disable();

      await should(debugModule.cleanup).be.calledOnce();
    });
  });

  describe('#post', () => {
    let request;
    let debugModule;
    beforeEach(async () => {
      request = new Request({});
      debugModule = new DebugModuleMock();
      debugController.modules = [debugModule];
      await debugController.enable();
    });

    it('should throw if the debugger is not enabled', async () => {
      debugController.debuggerStatus = false;

      await should(debugController.post(request)).be.rejectedWith(PreconditionError, { id: 'core.debugger.not_enabled' });
    });

    it('should execute method from DebugModule if the method starts with "Kuzzle."', async () => {
      request.input.body = {
        method: 'Kuzzle.DebugModuleMock.method_foo',
      };

      await debugController.post(request);

      await should(debugModule.method_foo)
        .be.calledOnce()
        .and.be.calledWith({});
    });

    it('should throw if the method starting with "Kuzzle." is not an existing method', async () => {
      request.input.body = {
        method: 'Kuzzle.DebugModuleMock.yeet',
      };

      await should(debugController.post(request)).be.rejectedWith(PreconditionError, { id: 'core.debugger.method_not_found' });
    });

    it('should throw if trying to call a method from the CDP when "security.debug.native_debug_protocol" is not enabled', async () => {
      request.input.body = {
        method: 'Debugger.enable',
      };

      await should(debugController.post(request)).be.rejectedWith(PreconditionError, { id: 'core.debugger.native_debug_protocol_usage_denied' });
    });

    it('should call the method from the CDP', async () => {
      request.input.body = {
        method: 'Debugger.enable',
      };

      debugController.inspectorPost = sinon.stub();
      kuzzle.config.security.debug.native_debug_protocol = true;
      await debugController.post(request);

      await should(debugController.inspectorPost).be.calledWith('Debugger.enable', {});
    });
  });
  
  describe('#addListener', () => {
    let request;
    let debugModule;
    beforeEach(async () => {
      request = new Request({});
      request.context.connection.protocol = 'websocket';
      debugModule = new DebugModuleMock();
      debugController.modules = [debugModule];
      await debugController.enable();
    });

    it('should throw if the request is sent with another protocol than Websocket', async () => {
      request.context.connection.protocol = 'http';
      await should(debugController.addListener(request)).be.rejectedWith(InternalError, { id: 'api.assert.unsupported_protocol' });
    });

    it('should throw if the debugger is not enabled', async () => {
      debugController.debuggerStatus = false;
      await should(debugController.addListener(request)).be.rejectedWith(PreconditionError, { id: 'core.debugger.not_enabled' });
    });

    it('should add the connectionId to the list of listener for the requested event', async () => {
      request.input.body = {
        event: 'Kuzzle.DebugModuleMock.event_foo',
      };
      request.context.connection.id = 'foobar';

      await debugController.addListener(request);
      should(debugController.events.get('Kuzzle.DebugModuleMock.event_foo')).be.eql(new Set(['foobar']));
    });
  });

  describe('#removeListener', () => {
    let request;
    let debugModule;
    beforeEach(async () => {
      request = new Request({});
      request.context.connection.protocol = 'websocket';
      debugModule = new DebugModuleMock();
      debugController.modules = [debugModule];
      await debugController.enable();
    });

    it('should throw if the request is sent with another protocol than Websocket', async () => {
      request.context.connection.protocol = 'http';
      await should(debugController.removeListener(request)).be.rejectedWith(InternalError, { id: 'api.assert.unsupported_protocol' });
    });

    it('should throw if the debugger is not enabled', async () => {
      debugController.debuggerStatus = false;
      await should(debugController.removeListener(request)).be.rejectedWith(PreconditionError, { id: 'core.debugger.not_enabled' });
    });

    it('should remove the connectionId from the list of listener for the requested event', async () => {
      request.input.body = {
        event: 'Kuzzle.DebugModuleMock.event_foo',
      };
      request.context.connection.id = 'foobar';

      debugController.events = new Map([['Kuzzle.DebugModuleMock.event_foo', new Set(['foobar'])]]);
      await debugController.removeListener(request);
      should(debugController.events.get('Kuzzle.DebugModuleMock.event_foo')).be.eql(new Set([]));
    });
  });

  describe('#inspectorPost', () => {
    let debugModule;
    beforeEach(async () => {
      debugModule = new DebugModuleMock();
      debugController.modules = [debugModule];
      await debugController.enable();
    });

    it('should throw if the debugger is not enabled', async () => {
      debugController.debuggerStatus = false;
      await should(debugController.inspectorPost('method', {})).be.rejectedWith(PreconditionError, { id: 'core.debugger.not_enabled' });
    });

    it('should resolve the result of the post to the inspector using the CDP', async () => {
      const stub = sinon.stub(debugController.inspector, 'post').callsFake((method, params, callback) => {
        callback(null, { result: 'foo' });
      });

      const result = await debugController.inspectorPost('method', {});

      should(stub)
        .be.calledOnce()
        .and.be.calledWith('method', {}, sinon.match.func);
      
      should(result).be.eql({
        result: 'foo',
      });
    });

    it('should format and resolve the error of the post to the inspector using the CDP', async () => {
      const stub = sinon.stub(debugController.inspector, 'post').callsFake((method, params, callback) => {
        callback({ message: 'foo' }, null);
      });

      const result = await debugController.inspectorPost('method', {});

      should(stub)
        .be.calledOnce()
        .and.be.calledWith('method', {}, sinon.match.func);
      
      should(result).be.eql({
        error: '{"message":{"value":"foo","writable":true,"enumerable":true,"configurable":true}}',
      });
    });
  });

  describe('#notifyConnection', () => {
    it('should call entrypoint._notify', async () => {
      kuzzle.entryPoint._notify = sinon.stub().returns();
      global.kuzzle = kuzzle;

      await debugController.notifyConnection('foobar', 'my-event', { foo: 'bar' });

      should(kuzzle.entryPoint._notify).be.calledWith({
        channels: ['my-event'],
        connectionId: 'foobar',
        payload: { foo: 'bar' },
      });
    });
  });

  describe('#notifyGlobalListeners', () => {
    it('should notify every connections listening on "*"', async () => {
      debugController.events = new Map([['*', new Set(['foo', 'bar'])]]);

      sinon.stub(debugController, 'notifyConnection').resolves();
      await debugController.notifyGlobalListeners('my-event', { foo: 'bar' });

      should(debugController.notifyConnection).be.calledTwice();
      should(debugController.notifyConnection).be.calledWith('foo', 'kuzzle-debugger-event', { event: 'my-event', result: { foo: 'bar' } });
      should(debugController.notifyConnection).be.calledWith('bar', 'kuzzle-debugger-event', { event: 'my-event', result: { foo: 'bar' } });
    });
  });
});