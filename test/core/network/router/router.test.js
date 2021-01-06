'use strict';

const should = require('should');
const sinon = require('sinon');

const {
  RequestContext,
  PluginImplementationError
} = require('../../../../index');
const KuzzleMock = require('../../../mocks/kuzzle.mock');

const Router = require('../../../../lib/core/network/router');

describe('Test: router', () => {
  const protocol = 'foo';
  const connectionId = 'bar';
  let kuzzle;
  let router;
  let requestContext;

  beforeEach(() => {
    requestContext = new RequestContext({
      connection: {
        protocol,
        id: connectionId
      }
    });
    kuzzle = new KuzzleMock();
    router = new Router();
  });

  describe('#newConnection', () => {
    it('should have registered the connection', () => {
      router.newConnection(requestContext);

      const context = router.connections.get(connectionId);
      should(context).be.instanceOf(RequestContext);
      should(context.connectionId).be.eql(connectionId);
      should(context.protocol).be.eql(protocol);
      should(context.token).be.null();

      should(kuzzle.statistics.newConnection).be.calledOnce();
      should(kuzzle.statistics.newConnection).be.calledWith(requestContext);
    });

    it('should return an error if no connectionId is provided', () => {
      const context = new RequestContext({connection: {protocol}});
      router.newConnection(context);

      should(kuzzle.log.error)
        .calledOnce()
        .calledWith(sinon.match.instanceOf(PluginImplementationError));
    });

    it('should return an error if no protocol is provided', () => {
      const context = new RequestContext({connection: {id: connectionId}});
      router.newConnection(context);

      should(kuzzle.log.error)
        .calledOnce()
        .calledWith(sinon.match.instanceOf(PluginImplementationError));
    });
  });

  describe('#removeConnection', () => {
    let realtimeDisconnectStub;

    beforeEach(() => {
      realtimeDisconnectStub = kuzzle.ask
        .withArgs('core:realtime:user:remove')
        .resolves();
    });

    it('should remove the context from the context pool', () => {
      router.connections.set(connectionId, requestContext);
      router.removeConnection(requestContext);

      should(kuzzle.ask).calledWith('core:realtime:user:remove', connectionId);
      should(kuzzle.statistics.dropConnection)
        .calledOnce()
        .calledWith(requestContext);
      should(router.connections.has(connectionId)).be.false();
    });

    it('should remove the context from the context pool', () => {
      router.removeConnection(requestContext);

      should(realtimeDisconnectStub).not.be.called();
      should(kuzzle.statistics.dropConnection).not.be.called();
      should(kuzzle.log.error)
        .calledOnce()
        .calledWith(sinon.match.instanceOf(PluginImplementationError));
    });

    it('should return an error if no connectionId is provided', () => {
      const context = new RequestContext({connection: {protocol}});
      router.connections.set(connectionId, context);
      router.removeConnection(context);

      should(kuzzle.log.error)
        .calledOnce()
        .calledWith(sinon.match.instanceOf(PluginImplementationError));
    });

    it('should return an error if no protocol is provided', () => {
      const context = new RequestContext({connection: {id: connectionId}});
      router.connections.set(connectionId, context);
      router.removeConnection(context);

      should(kuzzle.log.error)
        .calledOnce()
        .calledWith(sinon.match.instanceOf(PluginImplementationError));
    });
  });

  describe('#isConnectionActive', () => {
    it('should resolve to false if the connection is unknown', () => {
      should(router.isConnectionAlive(requestContext)).be.false();
    });

    it('should interact correctly with newConnection/removeConnection', () => {
      router.newConnection(requestContext);
      should(router.isConnectionAlive(requestContext)).be.true();
      router.removeConnection(requestContext);
      should(router.isConnectionAlive(requestContext)).be.false();
    });

    it('should always return true for connections without an id', () => {
      const context = new RequestContext({
        connection: {
          id: null,
          protocol: 'foobar'
        }
      });
      should(router.isConnectionAlive(context)).be.true();
    });
  });
});
