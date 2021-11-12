'use strict';

const should = require('should');
const sinon = require('sinon');

const { NotFoundError, Request } = require('../../../../index');
const KuzzleMock = require('../../../mocks/kuzzle.mock');

const { HotelClerk } = require('../../../../lib/core/realtime/hotelClerk');

describe('Test: hotelClerk.join', () => {
  const connectionId = 'connectionid';
  let kuzzle;
  let hotelClerk;
  let request;
  let context;
  let realtimeModule;

  beforeEach(async () => {
    kuzzle = new KuzzleMock();
    realtimeModule = {
      notifier: {
        notifyUser: sinon.stub(),
      },
    };

    hotelClerk = new HotelClerk(realtimeModule);

    await hotelClerk.init();

    request = new Request({
      index: 'foo',
      collection: 'bar',
      controller: 'realtime',
      action: 'subscribe',
      body: {
        equals: {firstName: 'Ada'}
      },
      volatile: {
        foo: 'bar',
        bar: [ 'foo', 'bar', 'baz', 'qux']
      }
    }, {connectionId, token: null});

    kuzzle.config.limits.subscriptionMinterms = 0;

    kuzzle.koncorde.normalize.returns({
      id: 'foobar', index: 'foo/bar', filter: []
    });
  });

  it('should register a "join" event', async () => {
    sinon.stub(hotelClerk, 'join');

    kuzzle.ask.restore();
    await kuzzle.ask('core:realtime:join', 'request');

    should(hotelClerk.join).calledWith('request');
  });

  it('should allow to join an existing room', async () => {
    let result = await hotelClerk.subscribe(request);
    const roomId = result.roomId;

    should(result).be.an.Object();
    should(result).have.property('channel');
    should(result).have.property('roomId');
    should(hotelClerk.roomsCount).be.eql(1);
    should(realtimeModule.notifier.notifyUser).calledWithMatch(
      roomId,
      request,
      'in',
      { count: 1 });

    const request2 = new Request(
      {
        index: 'foo',
        collection: 'bar',
        controller: 'realtime',
        action: 'join',
        body: { roomId },
      },
      { connectionId: 'connection2', user: null });

    request2.input.body = {roomId};

    result = await hotelClerk.join(request2);

    should(result).be.an.Object();
    should(result).have.property('roomId', roomId);
    should(result).have.property('channel');
    should(hotelClerk.roomsCount).be.eql(1);
    should(realtimeModule.notifier.notifyUser).calledWithMatch(
      roomId,
      request2,
      'in',
      { count: 2 });
  });

  it('should throw if the room does not exist', () => {
    const joinRequest = new Request({
      index: 'foo',
      collection: 'bar',
      controller: 'realtime',
      action: 'join',
      body: {roomId: 'i-exist'}
    }, context);

    return should(hotelClerk.join(joinRequest)).be.rejectedWith(NotFoundError, {
      id: 'core.realtime.room_not_found',
    });
  });

  it('should propagate notification only with "cluster" option', async () => {
    const joinRequest = new Request({
      index: 'foo',
      collection: 'bar',
      controller: 'realtime',
      action: 'join',
      body: {roomId: 'i-exist'}
    }, context);
    const response = { cluster: false, channel: 'foobar', subscribed: true };
    hotelClerk.rooms.set('i-exist', {});
    sinon.stub(hotelClerk, 'subscribeToRoom').resolves(response);

    await hotelClerk.join(joinRequest);

    should(kuzzle.emit).not.be.called();

    response.cluster = true;

    await hotelClerk.join(joinRequest);

    should(kuzzle.emit).be.calledWith('core:realtime:subscribe:after', 'i-exist');
  });
});
