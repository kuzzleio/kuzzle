/**
 * This component initializes
 */
var
  should = require('should'),
  rewire = require('rewire'),
  params = require('rc')('kuzzle'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  Lb = rewire('../../../../lib/api/core/entryPoints/lb'),
  RequestObject = require('kuzzle-common-objects').Models.requestObject,
  ResponseObject = require('kuzzle-common-objects').Models.responseObject;

describe('Test: entryPoints/lb', function () {
  var
    kuzzle;

  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.start(params, {dummy: true})
      .then(function () {
        done();
      });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should construct the right object', function () {
    var lb = new Lb(kuzzle);

    should(lb).have.property('kuzzle');
    should(lb).have.property('channels');
    should(lb.channels).be.empty();

    should(lb.init).be.a.Function();
    should(lb.joinChannel).be.a.Function();
    should(lb.leaveChannel).be.a.Function();
    should(lb.notify).be.a.Function();
    should(lb.broadcast).be.a.Function();
  });

  it('should init listeners on init call', function () {
    var
      lb = new Lb(kuzzle),
      spyListen = sandbox.stub(kuzzle.services.list.lbBroker, 'listen');

    lb.init();
    should(spyListen.calledWith('request')).be.true();
    should(spyListen.calledWith('connection')).be.true();
    should(spyListen.calledWith('disconnect')).be.true();
    should(spyListen.calledWith('error')).be.true();
    should(spyListen.callCount).be.eql(4);
  });

  it('should send a message on room "joinChannel" on joinChannel call', function () {
    var
      lb = new Lb(kuzzle),
      data = {my: 'data'},
      spyListen = sandbox.stub(kuzzle.services.list.lbBroker, 'send');

    lb.joinChannel(data);
    should(spyListen.calledWith('joinChannel', data)).be.true();
    should(spyListen.callCount).be.eql(1);
  });

  it('should send a message on room "leaveChannel" on leaveChannel call', function () {
    var
      lb = new Lb(kuzzle),
      data = {my: 'data'},
      spyListen = sandbox.stub(kuzzle.services.list.lbBroker, 'send');

    lb.leaveChannel(data);
    should(spyListen.calledWith('leaveChannel', data)).be.true();
    should(spyListen.callCount).be.eql(1);
  });

  it('should call the funnel execute on event onRequest', function () {
    var
      data = {request: {}, context: {connection: {type: 'socketio', id: 'myid'}}},
      spyExecute = sandbox.stub(kuzzle.funnel, 'execute');

    Lb.__get__('onRequest').call({kuzzle: kuzzle}, data);

    should(spyExecute.callCount).be.eql(1);
  });

  it('should not call the funnel execute if information missing in data on event onRequest', function () {
    var
      data = {},
      spyExecute = sandbox.stub(kuzzle.funnel, 'execute');

    Lb.__get__('onRequest').call({kuzzle: kuzzle}, data);
    should(spyExecute.callCount).be.eql(0);

    data = {request: {}};
    Lb.__get__('onRequest').call({kuzzle: kuzzle}, data);
    should(spyExecute.callCount).be.eql(0);

    data = {request: {}, context: {}};
    Lb.__get__('onRequest').call({kuzzle: kuzzle}, data);
    should(spyExecute.callCount).be.eql(0);

    data = {request: {}, context: {connection: {}}};
    Lb.__get__('onRequest').call({kuzzle: kuzzle}, data);
    should(spyExecute.callCount).be.eql(0);
  });

  it('should call the funnel execute on event onRequest', function () {
    var
      data = {request: {}, context: {connection: {type: 'socketio', id: 'myid'}}},
      spyExecute = sandbox.stub(kuzzle.funnel, 'execute'),
      requestObject;

    Lb.__get__('onRequest').call({kuzzle: kuzzle}, data);

    requestObject = spyExecute.args[0][0];
    should(requestObject).instanceOf(RequestObject);
  });

  it('should call the funnel execute and send the response on broker on event onRequest', function () {
    var
      data = {request: {}, context: {connection: {type: 'socketio', id: 'myid'}}},
      spySend = sandbox.stub(kuzzle.services.list.lbBroker, 'send');

    sandbox.stub(kuzzle.funnel, 'execute', (requestObject, context, cb) => {
      var responseObject = new ResponseObject(requestObject, {});
      cb(null, responseObject);
    });
    Lb.__get__('onRequest').call({kuzzle: kuzzle}, data);

    should(spySend.calledWith('response')).be.true();
  });

  it('should send a message on room "notify" on notify call', function () {
    var
      lb = new Lb(kuzzle),
      data = {my: 'data'},
      spyListen = sandbox.stub(kuzzle.services.list.lbBroker, 'send');

    lb.notify(data);
    should(spyListen.calledWith('notify', data)).be.true();
    should(spyListen.callCount).be.eql(1);
  });

  it('should send a message on room "broadcast" on broadcast call', function () {
    var
      lb = new Lb(kuzzle),
      data = {my: 'data'},
      spyListen = sandbox.stub(kuzzle.services.list.lbBroker, 'send');

    lb.broadcast(data);
    should(spyListen.calledWith('broadcast', data)).be.true();
    should(spyListen.callCount).be.eql(1);
  });

  it('should call the router removeConnection on event onDisconnect', function () {
    var
      data = {context: {connection: {type: 'socketio', id: 'myid'}}},
      spyRemoveConnection = sandbox.stub(kuzzle.router, 'removeConnection');

    Lb.__get__('onDisconnect').call({kuzzle: kuzzle}, data);

    should(spyRemoveConnection.calledWith(data.context)).be.true();
  });

  it('should not call the router if the data has no context on event onDisconnect', function () {
    var
      data = {},
      spyRemoveConnection = sandbox.stub(kuzzle.router, 'removeConnection');

    Lb.__get__('onDisconnect').call({kuzzle: kuzzle}, data);

    should(spyRemoveConnection.callCount).be.eql(0);
  });

  it('should call the router newConnection on event onConnection', function () {
    var
      data = {context: {connection: {type: 'socketio', id: 'myid'}}},
      spyNewConnection = sandbox.stub(kuzzle.router, 'newConnection');

    Lb.__get__('onConnection').call({kuzzle: kuzzle}, data);

    should(spyNewConnection.calledWith(data.context.connection.type, data.context.connection.id)).be.true();
  });

  it('should not call the router if the data has no context on event onConnection', function () {
    var
      data = {},
      spyNewConnection = sandbox.stub(kuzzle.router, 'newConnection');

    Lb.__get__('onConnection').call({kuzzle: kuzzle}, data);
    should(spyNewConnection.callCount).be.eql(0);

    data.context = {};
    Lb.__get__('onConnection').call({kuzzle: kuzzle}, data);
    should(spyNewConnection.callCount).be.eql(0);

    data.context = {connection: {}};
    Lb.__get__('onConnection').call({kuzzle: kuzzle}, data);
    should(spyNewConnection.callCount).be.eql(0);

    data.context = {connection: {type: 'type'}};
    Lb.__get__('onConnection').call({kuzzle: kuzzle}, data);
    should(spyNewConnection.callCount).be.eql(0);

    data.context = {connection: {type: 'type', id: 'id'}};
    Lb.__get__('onConnection').call({kuzzle: kuzzle}, data);
    should(spyNewConnection.callCount).be.eql(1);
  });

});
