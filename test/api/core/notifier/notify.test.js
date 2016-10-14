/**
 * Tests the notify function of the Notifier core component.
 * Besides the init() function, this is the only exposed method to the world, and this is the
 * central point of communication for the whole Kuzzle project.
 */
var
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Kuzzle = require.main.require('lib/api/kuzzle'),
  Notifier = require.main.require('lib/api/core/notifier'),
  NotificationObject = require.main.require('lib/api/core/models/notificationObject');

describe('Test: notifier.notify', () => {
  var
    kuzzle,
    notifier,
    notification,
    dispatchStub,
    triggerStub,
    getChannelsStub;

  before(() => {
    kuzzle = new Kuzzle();
    notification = new NotificationObject({}, {});
  });

  beforeEach(() => {
    dispatchStub = sandbox.stub(kuzzle.entryPoints.proxy, 'dispatch');
    triggerStub = sandbox.stub(kuzzle.pluginsManager, 'trigger');
    getChannelsStub = sandbox.stub(kuzzle.hotelClerk, 'getChannels').returns(['foobar']);
    notifier = new Notifier(kuzzle);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should do nothing when no rooms to notify are provided', () => {
    should(notifier.notify(undefined, {}, {})).be.false();
    should(dispatchStub.called).be.false();
    should(triggerStub.called).be.false();
    should(getChannelsStub.called).be.false();
  });

  it('should notify instead of broadcasting if there is a connection ID', () => {
    var data = {payload: notification.toJson(), channels: ['foobar'], id: 'someID'};

    notifier.notify(['foobar'], {}, {}, 'someID');

    should(getChannelsStub.calledOnce).be.true();
    should(dispatchStub.calledOnce).be.true();
    should(triggerStub.calledOnce).be.true();
    should(dispatchStub.calledWithMatch('notify', data)).be.true();
    should(triggerStub.calledWithMatch('proxy:notify', data)).be.true();
  });

  it('should aggregate channels from multiple rooms', () => {
    var data = {payload: notification.toJson(), channels: ['foo', 'bar', 'baz'], id: undefined};

    getChannelsStub.onCall(0).returns(['foo']);
    getChannelsStub.onCall(1).returns(['bar']);
    getChannelsStub.onCall(2).returns(['baz']);

    notifier.notify(['room1', 'room2', 'room3'], {}, {});

    should(getChannelsStub.calledThrice).be.true();
    should(dispatchStub.calledOnce).be.true();
    should(triggerStub.calledOnce).be.true();
    should(dispatchStub.calledWithMatch('broadcast', data)).be.true();
    should(triggerStub.calledWithMatch('proxy:broadcast', data)).be.true();
  });
});
