'use strict';

const should = require('should');
const sinon = require('sinon');

const {
  Request,
  BadRequestError,
  SizeLimitError,
} = require('../../../../index');
const KuzzleMock = require('../../../mocks/kuzzle.mock');

const HotelClerk = require('../../../../lib/core/realtime/hotelClerk');

describe('Test: hotelClerk.subscribe', () => {
  const connectionId = 'connectionid';
  let kuzzle;
  let hotelClerk;
  let request;
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
  });

  it('should register a "subscribe" event', async () => {
    sinon.stub(hotelClerk, 'subscribe');

    kuzzle.ask.restore();
    await kuzzle.ask('core:realtime:subscribe', 'foo');

    should(hotelClerk.subscribe).calledWith('foo');
  });

  it('should initialize base structures', () => {
    should(hotelClerk.rooms).be.empty();
    should(hotelClerk.customers).be.empty();
    should(hotelClerk.roomsCount).be.a.Number().and.be.eql(0);
  });

  it('should register a new room and customer', async () => {
    kuzzle.koncorde.normalize
      .onFirstCall().returns({id: 'foobar', index: 'foo/bar', filter: []})
      .onSecondCall().returns({id: 'barfoo', index: 'foo/bar', filter: []});

    kuzzle.koncorde.store
      .onFirstCall().returns({id: 'foobar'})
      .onSecondCall().returns({id: 'barfoo'});

    kuzzle.koncorde.store
      .onFirstCall().returns('foobar')
      .onSecondCall().returns('barfoo');

    let response = await hotelClerk.subscribe(request);

    should(kuzzle.koncorde.normalize).calledOnce();
    should(kuzzle.koncorde.store).calledOnce();
    should(response.roomId).be.eql('foobar');
    should(response).have.property('channel');

    should(hotelClerk.roomsCount).be.eql(1);
    should(realtimeModule.notifier.notifyUser).calledWithMatch(
      'foobar',
      request,
      'in',
      { count: 1 });

    const roomId = hotelClerk.rooms.get(response.roomId).id;

    const customer = hotelClerk.customers.get(connectionId);

    should(customer).have.value(roomId, request.input.volatile);

    const room = hotelClerk.rooms.get(roomId);
    should(room.channels).be.an.Object().and.not.be.undefined();
    should(Object.keys(room.channels).length).be.exactly(1);

    const channel = Object.keys(room.channels)[0];
    should(room.channels[channel].scope).be.exactly('all');
    should(room.channels[channel].users).be.exactly('none');

    response = await hotelClerk.subscribe(request);

    should(kuzzle.koncorde.normalize.callCount).be.eql(2);
    should(kuzzle.koncorde.store.callCount).be.eql(2);
    should(response.roomId).be.eql('barfoo');
    should(hotelClerk.roomsCount).be.eql(2);
    should(realtimeModule.notifier.notifyUser).calledWithMatch(
      'barfoo',
      request,
      'in',
      { count: 1 });

    should(kuzzle.emit).be.calledWithMatch('core:realtime:user:subscribe:after', {
      index: request.input.args.index,
      collection: request.input.args.collection,
      filters: request.input.body,
      roomId,
      connectionId,
    });
  });

  it('should return the same response when the user has already subscribed to the filter', async () => {
    const firstResponse = await hotelClerk.subscribe(request);

    should(hotelClerk.roomsCount).be.eql(1);

    const secondResponse = await hotelClerk.subscribe(request);

    should(secondResponse).match(firstResponse);
    should(hotelClerk.roomsCount).be.eql(1);
    should(realtimeModule.notifier.notifyUser).calledWithMatch(
      secondResponse.roomId,
      request,
      'in',
      { count: 1 });
  });

  it('should reject when Koncorde throws an error', () => {
    kuzzle.koncorde.normalize.throws(new Error('test'));

    return should(hotelClerk.subscribe(request)).be.rejected();
  });

  it('should reject if no index is provided', () => {
    request.input.args.index = null;
    return should(hotelClerk.subscribe(request)).rejectedWith(BadRequestError, {
      id: 'api.assert.missing_argument',
    });
  });

  it('should reject with an error if no collection is provided', () => {
    request.input.args.collection = null;

    return should(hotelClerk.subscribe(request)).rejectedWith(BadRequestError, {
      id: 'api.assert.missing_argument',
    });
  });

  it('should allow subscribing with an empty filter', async () => {
    request.input.body = {};

    const result = await hotelClerk.subscribe(request);

    should(hotelClerk.roomsCount).be.eql(1);
    should(realtimeModule.notifier.notifyUser).calledWithMatch(
      result.roomId,
      request,
      'in',
      { count: 1 });
  });

  it('should reject the subscription if the given scope argument is incorrect', () => {
    request.input.args.scope = 'foo';

    return should(hotelClerk.subscribe(request)).rejectedWith(BadRequestError, {
      id: 'core.realtime.invalid_scope',
    });
  });

  it('should reject the subscription if the given users argument is incorrect', () => {
    request.input.args.users = 'foo';

    return should(hotelClerk.subscribe(request)).rejectedWith(BadRequestError, {
      id: 'core.realtime.invalid_users',
    });
  });

  it('should refuse a subscription if the rooms limit has been reached', () => {
    hotelClerk.roomsCount = kuzzle.config.limits.subscriptionRooms;

    return should(hotelClerk.subscribe(request)).rejectedWith(SizeLimitError, {
      id: 'core.realtime.too_many_rooms',
    });
  });

  it('should impose no limit to the number of rooms if the limit is set to 0', () => {
    kuzzle.config.limits.subscriptionRooms = 0;
    hotelClerk.roomsCount = Number.MAX_SAFE_INTEGER - 1;

    return should(hotelClerk.subscribe(request)).be.fulfilled();
  });

  it('should discard the request if the associated connection is no longer active', async () => {
    kuzzle.router.isConnectionAlive.returns(false);
    sinon.stub(hotelClerk, '_createRoom');

    await hotelClerk.subscribe(request);

    should(hotelClerk._createRoom).not.called();
  });
});
