'use strict';

const should = require('should');
const sinon = require('sinon');

const {
  Request,
} = require('../../../index');
const { DebugController } = require('../../../lib/api/controllers');
const KuzzleMock = require('../../mocks/kuzzle.mock');


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
  });


  describe('#enable', () => {
    it('should connect the debugger', async () => {
      sinon.stub(debugController.inspector, 'connect').returns();
      await debugController.enable();

      await should(debugController.inspector.connect).be.calledOnce();

      should(debugController.debuggerStatus).be.true();

      await debugController.enable();

      await should(debugController.inspector.connect).not.be.calledTwice();
    });
  });
});