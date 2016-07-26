/**
 * This component initializes
 */
var
  should = require('should'),
  rewire = require('rewire'),
  params = require('rc')('kuzzle'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  KuzzleServer = require.main.require('lib/api/kuzzleServer'),
  KuzzleProxy = rewire('../../../../lib/api/core/entryPoints/kuzzleProxy'),
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  ResponseObject = require('kuzzle-common-objects').Models.responseObject;

describe('Test: entryPoints/proxy', () => {
  var
    kuzzle;

  before(() => {
    kuzzle = new KuzzleServer();
  });

  beforeEach(() => {
    sandbox.stub(kuzzle.internalEngine, 'get').resolves({});
    return kuzzle.services.init({whitelist: []});
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should construct the right object', () => {
    var proxy = new KuzzleProxy(kuzzle);

    should(proxy).have.property('kuzzle');
    should(proxy).have.property('channels');
    should(proxy.channels).be.empty();

    should(proxy.init).be.a.Function();
    should(proxy.joinChannel).be.a.Function();
    should(proxy.leaveChannel).be.a.Function();
    should(proxy.notify).be.a.Function();
    should(proxy.broadcast).be.a.Function();
  });

  it('should init listeners on init call', () => {
    var
      proxy = new KuzzleProxy(kuzzle),
      spyListen = sandbox.stub(proxy.kuzzle.services.list.proxyBroker, 'listen');

    proxy.init();
    should(spyListen.calledWith('request')).be.true();
    should(spyListen.calledWith('connection')).be.true();
    should(spyListen.calledWith('disconnect')).be.true();
    should(spyListen.calledWith('error')).be.true();
    should(spyListen.callCount).be.eql(4);
  });

  it('should send a message on room "joinChannel" on joinChannel call', () => {
    var
      proxy = new KuzzleProxy(kuzzle),
      data = {my: 'data'},
      spyListen = sandbox.stub(proxy.kuzzle.services.list.proxyBroker, 'send');

    proxy.joinChannel(data);
    should(spyListen.calledWith('joinChannel', data)).be.true();
    should(spyListen.callCount).be.eql(1);
  });

  it('should send a message on room "leaveChannel" on leaveChannel call', () => {
    var
      proxy = new KuzzleProxy(kuzzle),
      data = {my: 'data'},
      spyListen = sandbox.stub(proxy.kuzzle.services.list.proxyBroker, 'send');

    proxy.leaveChannel(data);
    should(spyListen.calledWith('leaveChannel', data)).be.true();
    should(spyListen.callCount).be.eql(1);
  });

  it('should call the funnel execute on event onRequest', () => {
    var
      data = {request: {}, context: {connection: {type: 'socketio', id: 'myid'}}},
      spyExecute = sandbox.stub(kuzzle.funnel, 'execute');

    KuzzleProxy.__get__('onRequest').call({kuzzle: kuzzle}, data);

    should(spyExecute.callCount).be.eql(1);
  });

  it('should not call the funnel execute if information missing in data on event onRequest', () => {
    var
      data = {},
      spyExecute = sandbox.stub(kuzzle.funnel, 'execute');

    KuzzleProxy.__get__('onRequest').call({kuzzle: kuzzle}, data);
    should(spyExecute.callCount).be.eql(0);

    data = {request: {}};
    KuzzleProxy.__get__('onRequest').call({kuzzle: kuzzle}, data);
    should(spyExecute.callCount).be.eql(0);

    data = {request: {}, context: {}};
    KuzzleProxy.__get__('onRequest').call({kuzzle: kuzzle}, data);
    should(spyExecute.callCount).be.eql(0);

    data = {request: {}, context: {connection: {}}};
    KuzzleProxy.__get__('onRequest').call({kuzzle: kuzzle}, data);
    should(spyExecute.callCount).be.eql(0);
  });

  it('should call the funnel execute on event onRequest', () => {
    var
      data = {request: {}, context: {connection: {type: 'socketio', id: 'myid'}}},
      spyExecute = sandbox.stub(kuzzle.funnel, 'execute'),
      requestObject;

    KuzzleProxy.__get__('onRequest').call({kuzzle: kuzzle}, data);

    requestObject = spyExecute.args[0][0];
    should(requestObject).instanceOf(RequestObject);
  });

  it('should call the funnel execute and send the response on broker on event onRequest', () => {
    var
      data = {request: {}, context: {connection: {type: 'socketio', id: 'myid'}}},
      spySend = sandbox.stub(kuzzle.services.list.proxyBroker, 'send');

    sandbox.stub(kuzzle.funnel, 'execute', (requestObject, context, cb) => {
      var responseObject = new ResponseObject(requestObject, {});
      cb(null, responseObject);
    });
    KuzzleProxy.__get__('onRequest').call({kuzzle: kuzzle}, data);

    should(spySend.calledWith('response')).be.true();
  });

  it('should send a message on room "notify" on notify call', () => {
    var
      proxy = new KuzzleProxy(kuzzle),
      data = {my: 'data'},
      spyListen = sandbox.stub(proxy.kuzzle.services.list.proxyBroker, 'send');

    proxy.notify(data);
    should(spyListen.calledWith('notify', data)).be.true();
    should(spyListen.callCount).be.eql(1);
  });

  it('should send a message on room "broadcast" on broadcast call', () => {
    var
      proxy = new KuzzleProxy(kuzzle),
      data = {my: 'data'},
      spyListen = sandbox.stub(proxy.kuzzle.services.list.proxyBroker, 'send');

    proxy.broadcast(data);
    should(spyListen.calledWith('broadcast', data)).be.true();
    should(spyListen.callCount).be.eql(1);
  });

  it('should call the router removeConnection on event onDisconnect', () => {
    var
      data = {context: {connection: {type: 'socketio', id: 'myid'}}},
      spyRemoveConnection = sandbox.stub(kuzzle.router, 'removeConnection');

    KuzzleProxy.__get__('onDisconnect').call({kuzzle: kuzzle}, data);

    should(spyRemoveConnection.calledWith(data.context)).be.true();
  });

  it('should not call the router if the data has no context on event onDisconnect', () => {
    var
      data = {},
      spyRemoveConnection = sandbox.stub(kuzzle.router, 'removeConnection');

    KuzzleProxy.__get__('onDisconnect').call({kuzzle: kuzzle}, data);

    should(spyRemoveConnection.callCount).be.eql(0);
  });

  it('should call the router newConnection on event onConnection', () => {
    var
      data = {context: {connection: {type: 'socketio', id: 'myid'}}},
      spyNewConnection = sandbox.stub(kuzzle.router, 'newConnection');

    KuzzleProxy.__get__('onConnection').call({kuzzle: kuzzle}, data);

    should(spyNewConnection.calledWith(data.context.connection.type, data.context.connection.id)).be.true();
  });

  it('should not call the router if the data has no context on event onConnection', () => {
    var
      data = {},
      spyNewConnection = sandbox.stub(kuzzle.router, 'newConnection');

    KuzzleProxy.__get__('onConnection').call({kuzzle: kuzzle}, data);
    should(spyNewConnection.callCount).be.eql(0);

    data.context = {};
    KuzzleProxy.__get__('onConnection').call({kuzzle: kuzzle}, data);
    should(spyNewConnection.callCount).be.eql(0);

    data.context = {connection: {}};
    KuzzleProxy.__get__('onConnection').call({kuzzle: kuzzle}, data);
    should(spyNewConnection.callCount).be.eql(0);

    data.context = {connection: {type: 'type'}};
    KuzzleProxy.__get__('onConnection').call({kuzzle: kuzzle}, data);
    should(spyNewConnection.callCount).be.eql(0);

    data.context = {connection: {type: 'type', id: 'id'}};
    KuzzleProxy.__get__('onConnection').call({kuzzle: kuzzle}, data);
    should(spyNewConnection.callCount).be.eql(1);
  });

});
