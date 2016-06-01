/**
 * This component initializes
 */
var
  should = require('should'),
  http = require('http'),
  rewire = require('rewire'),
  params = require('rc')('kuzzle'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  Lb = require.main.require('lib/api/core/entryPoints/lb');

describe('Test: entryPoints/http', function () {
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
    should(lb.channels).be.empty;

    should(lb.init).be.a.Function();
    should(lb.joinChannel).be.a.Function();
    should(lb.leaveChannel).be.a.Function();
    should(lb.notify).be.a.Function();
    should(lb.broadcast).be.a.Function();
  });

  it('should init listeners on init call', function () {
    var
      lb = new Lb(kuzzle),
      spyListen = sandbox.stub(lb.kuzzle.services.list.lbBroker, 'listen');

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
      spyListen = sandbox.stub(lb.kuzzle.services.list.lbBroker, 'send');

    lb.joinChannel(data);
    should(spyListen.calledWith('joinChannel', data)).be.true();
    should(spyListen.callCount).be.eql(1);
  });

  it('should send a message on room "leaveChannel" on leaveChannel call', function () {
    var
      lb = new Lb(kuzzle),
      data = {my: 'data'},
      spyListen = sandbox.stub(lb.kuzzle.services.list.lbBroker, 'send');

    lb.leaveChannel(data);
    should(spyListen.calledWith('leaveChannel', data)).be.true();
    should(spyListen.callCount).be.eql(1);
  });

  it('should send a message on room "notify" on notify call', function () {
    var
      lb = new Lb(kuzzle),
      data = {my: 'data'},
      spyListen = sandbox.stub(lb.kuzzle.services.list.lbBroker, 'send');

    lb.notify(data);
    should(spyListen.calledWith('notify', data)).be.true();
    should(spyListen.callCount).be.eql(1);
  });

  it('should send a message on room "broadcast" on broadcast call', function () {
    var
      lb = new Lb(kuzzle),
      data = {my: 'data'},
      spyListen = sandbox.stub(lb.kuzzle.services.list.lbBroker, 'send');

    lb.broadcast(data);
    should(spyListen.calledWith('broadcast', data)).be.true();
    should(spyListen.callCount).be.eql(1);
  });

});
