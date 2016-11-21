/**
 * Tests the notify function of the Notifier core component.
 * Besides the init() function, this is the only exposed method to the world, and this is the
 * central point of communication for the whole Kuzzle project.
 */
var
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Kuzzle = require('../../../mocks/kuzzle.mock'),
  Notifier = require.main.require('lib/api/core/notifier'),
  NotificationObject = require.main.require('lib/api/core/models/notificationObject');

describe('Test: notifier.notify', () => {
  var
    kuzzle,
    notifier,
    notification,
    dispatchStub,
    triggerStub,
    addToChannelsStub;

  before(() => {
  });

  beforeEach(() => {
    kuzzle = new Kuzzle();
    notification = new NotificationObject({}, {});

    dispatchStub = kuzzle.entryPoints.proxy.dispatch;
    triggerStub = kuzzle.pluginsManager.trigger;
    kuzzle.hotelClerk.addToChannels = sinon.spy(c => c.push('foobar'));
    addToChannelsStub = kuzzle.hotelClerk.addToChannels;

    notifier = new Notifier(kuzzle);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should do nothing when no rooms to notify are provided', () => {
    should(notifier.notify(undefined, {}, {})).be.false();
    should(dispatchStub.called).be.false();
    should(triggerStub.called).be.false();
    should(addToChannelsStub.called).be.false();
  });

  it('should notify instead of broadcasting if there is a connection ID', () => {
    var data = {payload: notification.toJson(), channels: ['foobar'], id: 'someID'};

    notifier.notify(['foobar'], {}, {}, 'someID');

    should(addToChannelsStub.calledOnce).be.true();
    should(dispatchStub.calledOnce).be.true();
    should(triggerStub.calledOnce).be.true();
    should(dispatchStub.calledWithMatch('notify', data)).be.true();
    should(triggerStub.calledWithMatch('proxy:notify', data)).be.true();
  });

  it('should aggregate channels from multiple rooms', () => {
    var data = {payload: notification.toJson(), channels: ['foobar', 'foobar', 'foobar'], id: undefined};

    notifier.notify(['room1', 'room2', 'room3'], {}, {});

    should(addToChannelsStub.calledThrice).be.true();
    should(dispatchStub.calledOnce).be.true();
    should(triggerStub.calledOnce).be.true();
    should(dispatchStub.calledWithMatch('broadcast', data)).be.true();
    should(triggerStub.calledWithMatch('proxy:broadcast', data)).be.true();
  });
});
