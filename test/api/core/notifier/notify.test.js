var
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  Notifier = require('../../../../lib/api/core/notifier'),
  NotificationObject = require('../../../../lib/api/core/models/notificationObject'),
  Request = require('kuzzle-common-objects').Request;

describe('Test: notifier.notify', () => {
  var
    kuzzle,
    notifier,
    notification,
    dispatchStub,
    triggerStub,
    addToChannelsStub, request;

  before(() => {
  });

  beforeEach(() => {
    request = new Request({});
    kuzzle = new KuzzleMock();
    notification = new NotificationObject({}, request);

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
    should(notifier.notify(undefined, request, {})).be.false();
    should(dispatchStub.called).be.false();
    should(triggerStub.called).be.false();
    should(addToChannelsStub.called).be.false();
  });

  it('should notify instead of broadcasting if there is a connectionId', () => {
    var data = {payload: notification.toJson(), channels: ['foobar'], connectionId: 'someID'};

    notifier.notify(['foobar'], request, {}, 'someID');

    should(addToChannelsStub.calledOnce).be.true();
    should(dispatchStub.calledOnce).be.true();
    should(triggerStub.calledOnce).be.true();
    should(dispatchStub).calledWithMatch('notify', data);
    should(triggerStub).calledWithMatch('proxy:notify', data);
  });

  it('should aggregate channels from multiple rooms', () => {
    var data = {payload: notification.toJson(), channels: ['foobar', 'foobar', 'foobar'], id: undefined};

    notifier.notify(['room1', 'room2', 'room3'], request, {});

    should(addToChannelsStub.calledThrice).be.true();
    should(dispatchStub.calledOnce).be.true();
    should(triggerStub.calledOnce).be.true();
    should(dispatchStub).calledWithMatch('broadcast', data);
    should(triggerStub).calledWithMatch('proxy:broadcast', data);
  });
});
