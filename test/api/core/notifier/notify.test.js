const
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  Notifier = require('../../../../lib/api/core/notifier'),
  NotificationObject = require('../../../../lib/api/core/models/notificationObject'),
  Request = require('kuzzle-common-objects').Request;

describe('Test: notifier.notify', () => {
  let
    kuzzle,
    notifier,
    notification,
    dispatchStub,
    addToChannelsStub, request;

  beforeEach(() => {
    request = new Request({});
    kuzzle = new KuzzleMock();
    notification = new NotificationObject({}, request);

    dispatchStub = kuzzle.entryPoints.proxy.dispatch;
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
    should(addToChannelsStub.called).be.false();
  });

  it('should notify instead of broadcasting if there is a connectionId', () => {
    const data = {payload: notification.toJson(), channels: ['foobar'], connectionId: 'someID'};

    notifier.notify(['foobar'], request, {}, 'someID');

    should(addToChannelsStub.calledOnce).be.true();
    should(dispatchStub.calledOnce).be.true();
    should(dispatchStub).calledWithMatch('notify', data);
  });

  it('should aggregate channels from multiple rooms', () => {
    const data = {payload: notification.toJson(), channels: ['foobar', 'foobar', 'foobar'], id: undefined};

    notifier.notify(['room1', 'room2', 'room3'], request, {});

    should(addToChannelsStub.calledThrice).be.true();
    should(dispatchStub.calledOnce).be.true();
    should(dispatchStub).calledWithMatch('broadcast', data);
  });
});
