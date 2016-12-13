var
  should = require('should'),
  sinon = require('sinon'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  RouterController = require('../../../../lib/api/controllers/routerController'),
  PluginImplementationError = require('kuzzle-common-objects').errors.PluginImplementationError,
  RequestContext = require('kuzzle-common-objects').models.RequestContext;

describe('Test: routerController', () => {
  var
    kuzzle,
    sandbox,
    routerController,
    protocol = 'foo',
    connectionId = 'bar',
    requestContext;

  before(() => {
    sandbox = sinon.sandbox.create();
  });

  beforeEach(() => {
    requestContext = new RequestContext({
      protocol,
      connectionId
    });
    kuzzle = new KuzzleMock();
    routerController = new RouterController(kuzzle);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#newConnection', () => {
    it('should have registered the connection', () => {
      var context;

      routerController.newConnection(requestContext);

      context = routerController.connections[connectionId];
      should(context).be.instanceOf(RequestContext);
      should(context.connectionId).be.eql(connectionId);
      should(context.protocol).be.eql(protocol);
      should(context.token).be.null();

      should(kuzzle.statistics.newConnection).be.calledOnce();
      should(kuzzle.statistics.newConnection).be.calledWith(requestContext);
    });

    it('should return an error if no connectionId is provided', () => {
      requestContext.connectionId = null;
      routerController.newConnection(requestContext);

      should(kuzzle.pluginsManager.trigger).be.calledOnce();
      should(kuzzle.pluginsManager.trigger.firstCall.args[0]).be.eql('log:error');
      should(kuzzle.pluginsManager.trigger.firstCall.args[1]).be.instanceOf(PluginImplementationError);
    });

    it('should return an error if no protocol is provided', () => {
      requestContext.protocol = null;
      routerController.newConnection(requestContext);

      should(kuzzle.pluginsManager.trigger).be.calledOnce();
      should(kuzzle.pluginsManager.trigger.firstCall.args[0]).be.eql('log:error');
      should(kuzzle.pluginsManager.trigger.firstCall.args[1]).be.instanceOf(PluginImplementationError);
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
      should(kuzzle.pluginsManager.trigger).be.calledOnce();
      should(kuzzle.pluginsManager.trigger.firstCall.args[0]).be.eql('log:error');
      should(kuzzle.pluginsManager.trigger.firstCall.args[1]).be.instanceOf(PluginImplementationError);
    });

    it('should return an error if no connectionId is provided', () => {
      requestContext.connectionId = null;
      routerController.connections[connectionId] = requestContext;
      routerController.removeConnection(requestContext);

      should(kuzzle.pluginsManager.trigger).be.calledOnce();
      should(kuzzle.pluginsManager.trigger.firstCall.args[0]).be.eql('log:error');
      should(kuzzle.pluginsManager.trigger.firstCall.args[1]).be.instanceOf(PluginImplementationError);
    });

    it('should return an error if no protocol is provided', () => {
      requestContext.protocol = null;
      routerController.connections[connectionId] = requestContext;
      routerController.removeConnection(requestContext);

      should(kuzzle.pluginsManager.trigger).be.calledOnce();
      should(kuzzle.pluginsManager.trigger.firstCall.args[0]).be.eql('log:error');
      should(kuzzle.pluginsManager.trigger.firstCall.args[1]).be.instanceOf(PluginImplementationError);
    });
  });
});
