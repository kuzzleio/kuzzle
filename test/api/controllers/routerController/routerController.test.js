const
  should = require('should'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  RouterController = require('../../../../lib/api/controllers/routerController'),
  PluginImplementationError = require('kuzzle-common-objects').errors.PluginImplementationError,
  RequestContext = require('kuzzle-common-objects').models.RequestContext;

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

      const context = routerController.connections[connectionId];
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

      should(kuzzle.emit).be.calledOnce();
      should(kuzzle.emit.firstCall.args[0]).be.eql('log:error');
      should(kuzzle.emit.firstCall.args[1]).be.instanceOf(PluginImplementationError);
    });

    it('should return an error if no protocol is provided', () => {
      const context = new RequestContext({connection: {id: connectionId}});
      routerController.newConnection(context);

      should(kuzzle.emit).be.calledOnce();
      should(kuzzle.emit.firstCall.args[0]).be.eql('log:error');
      should(kuzzle.emit.firstCall.args[1]).be.instanceOf(PluginImplementationError);
    });
  });

  describe('#removeConnection', () => {
    it('should remove the context from the context pool', () => {
      routerController.connections[connectionId] = requestContext;
      routerController.removeConnection(requestContext);

      should(kuzzle.hotelClerk.removeCustomerFromAllRooms).be.calledOnce();
      should(kuzzle.hotelClerk.removeCustomerFromAllRooms).be.calledWith(requestContext);
      should(kuzzle.statistics.dropConnection).be.calledOnce();
      should(kuzzle.statistics.dropConnection).be.calledWith(requestContext);
      should(routerController.connections[connectionId]).be.undefined();
    });

    it('should remove the context from the context pool', () => {
      routerController.removeConnection(requestContext);

      should(kuzzle.hotelClerk.removeCustomerFromAllRooms).not.be.called();
      should(kuzzle.statistics.dropConnection).not.be.called();
      should(kuzzle.emit).be.calledOnce();
      should(kuzzle.emit.firstCall.args[0]).be.eql('log:error');
      should(kuzzle.emit.firstCall.args[1]).be.instanceOf(PluginImplementationError);
    });

    it('should return an error if no connectionId is provided', () => {
      const context = new RequestContext({connection: {protocol}});
      routerController.connections[connectionId] = context;
      routerController.removeConnection(context);

      should(kuzzle.emit).be.calledOnce();
      should(kuzzle.emit.firstCall.args[0]).be.eql('log:error');
      should(kuzzle.emit.firstCall.args[1]).be.instanceOf(PluginImplementationError);
    });

    it('should return an error if no protocol is provided', () => {
      const context = new RequestContext({connection: {id: connectionId}});
      routerController.connections[connectionId] = context;
      routerController.removeConnection(context);

      should(kuzzle.emit).be.calledOnce();
      should(kuzzle.emit.firstCall.args[0]).be.eql('log:error');
      should(kuzzle.emit.firstCall.args[1]).be.instanceOf(PluginImplementationError);
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

    it('should always return true on HTTP connections', () => {
      const context = new RequestContext({
        connection: {
          id: connectionId,
          protocol: 'http'
        }
      });
      should(routerController.isConnectionAlive(context)).be.true();
    });
  });
});
