const
  should = require('should'),
  sinon = require('sinon'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  RouterController = require('../../../../lib/api/controllers/routerController'),
  {
    models: { RequestContext },
    errors: { PluginImplementationError }
  } = require('kuzzle-common-objects');

describe('Test: routerController', () => {
  const
    protocol = 'foo',
    connectionId = 'bar';
  let
    kuzzle,
    routerController,
    requestContext;

  beforeEach(() => {
    requestContext = new RequestContext({
      connection: {
        protocol,
        id: connectionId
      }
    });
    kuzzle = new KuzzleMock();
    routerController = new RouterController(kuzzle);
  });

  describe('#newConnection', () => {
    it('should have registered the connection', () => {
      routerController.newConnection(requestContext);

      const context = routerController.connections.get(connectionId);
      should(context).be.instanceOf(RequestContext);
      should(context.connectionId).be.eql(connectionId);
      should(context.protocol).be.eql(protocol);
      should(context.token).be.null();

      should(kuzzle.statistics.newConnection).be.calledOnce();
      should(kuzzle.statistics.newConnection).be.calledWith(requestContext);
    });

    it('should return an error if no connectionId is provided', () => {
      const context = new RequestContext({connection: {protocol}});
      routerController.newConnection(context);

      should(kuzzle.log.error)
        .calledOnce()
        .calledWith(sinon.match.instanceOf(PluginImplementationError));
    });

    it('should return an error if no protocol is provided', () => {
      const context = new RequestContext({connection: {id: connectionId}});
      routerController.newConnection(context);

      should(kuzzle.log.error)
        .calledOnce()
        .calledWith(sinon.match.instanceOf(PluginImplementationError));
    });
  });

  describe('#removeConnection', () => {
    it('should remove the context from the context pool', () => {
      routerController.connections.set(connectionId, requestContext);
      routerController.removeConnection(requestContext);

      should(kuzzle.hotelClerk.removeCustomerFromAllRooms)
        .calledOnce()
        .calledWith(requestContext);
      should(kuzzle.statistics.dropConnection)
        .calledOnce()
        .calledWith(requestContext);
      should(routerController.connections.has(connectionId)).be.false();
    });

    it('should remove the context from the context pool', () => {
      routerController.removeConnection(requestContext);

      should(kuzzle.hotelClerk.removeCustomerFromAllRooms).not.be.called();
      should(kuzzle.statistics.dropConnection).not.be.called();
      should(kuzzle.log.error)
        .calledOnce()
        .calledWith(sinon.match.instanceOf(PluginImplementationError));
    });

    it('should return an error if no connectionId is provided', () => {
      const context = new RequestContext({connection: {protocol}});
      routerController.connections.set(connectionId, context);
      routerController.removeConnection(context);

      should(kuzzle.log.error)
        .calledOnce()
        .calledWith(sinon.match.instanceOf(PluginImplementationError));
    });

    it('should return an error if no protocol is provided', () => {
      const context = new RequestContext({connection: {id: connectionId}});
      routerController.connections.set(connectionId, context);
      routerController.removeConnection(context);

      should(kuzzle.log.error)
        .calledOnce()
        .calledWith(sinon.match.instanceOf(PluginImplementationError));
    });
  });

  describe('#isConnectionActive', () => {
    it('should resolve to false if the connection is unknown', () => {
      should(routerController.isConnectionAlive(requestContext)).be.false();
    });

    it('should interact correctly with newConnection/removeConnection', () => {
      routerController.newConnection(requestContext);
      should(routerController.isConnectionAlive(requestContext)).be.true();
      routerController.removeConnection(requestContext);
      should(routerController.isConnectionAlive(requestContext)).be.false();
    });

    it('should always return true for connections without an id', () => {
      const context = new RequestContext({
        connection: {
          id: null,
          protocol: 'foobar'
        }
      });
      should(routerController.isConnectionAlive(context)).be.true();
    });
  });
});
