'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  Bluebird = require('bluebird'),
  HotelClerk = require('../../../lib/core/hotelClerk'),
  KuzzleMock = require('../../mocks/kuzzle.mock'),
  {
    Request,
    errors: {
      BadRequestError,
      NotFoundError,
      SizeLimitError
    }
  } = require('kuzzle-common-objects');

describe('Test: hotelClerk.addSubscription', () => {
  let
    kuzzle,
    hotelClerk,
    request,
    connectionId = 'connectionid',
    context;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    hotelClerk = new HotelClerk(kuzzle);

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

  it('should initialize base structures', () => {
    should(hotelClerk.rooms).be.empty();
    should(hotelClerk.customers).be.empty();
    should(hotelClerk.roomsCount).be.a.Number().and.be.eql(0);
  });

  it('should register a new room and customer', () => {
    kuzzle.koncorde.normalize
      .onFirstCall().returns(Bluebird.resolve({id: 'foobar'}))
      .onSecondCall().returns(Bluebird.resolve({id: 'barfoo'}));

    kuzzle.koncorde.store
      .onFirstCall().returns({id: 'foobar'})
      .onSecondCall().returns({id: 'barfoo'});

    return hotelClerk.addSubscription(request)
      .then(response => {
        should(kuzzle.koncorde.normalize).calledOnce();
        should(kuzzle.koncorde.store).calledOnce();
        should(response.roomId).be.eql('foobar');
        should(response).have.property('channel');

        should(hotelClerk.roomsCount).be.eql(1);

        const roomId = hotelClerk.rooms.get(response.roomId).id;
        const customer = hotelClerk.customers.get(connectionId);

        should(customer).have.value(roomId, request.input.volatile);

        const room = hotelClerk.rooms.get(roomId);
        should(room.channels).be.an.Object().and.not.be.undefined();
        should(Object.keys(room.channels).length).be.exactly(1);

        const channel = Object.keys(room.channels)[0];
        should(room.channels[channel].scope).be.exactly('all');
        should(room.channels[channel].users).be.exactly('none');

        return hotelClerk.addSubscription(request);
      })
      .then(response => {
        should(kuzzle.koncorde.normalize.callCount).be.eql(2);
        should(kuzzle.koncorde.store.callCount).be.eql(2);
        should(response.roomId).be.eql('barfoo');
        should(hotelClerk.roomsCount).be.eql(2);
      });
  });

  it('should return the same response when the user has already subscribed to the filter', () => {
    let response;

    return hotelClerk.addSubscription(request)
      .then(result => {
        response = result;
        should(hotelClerk.roomsCount).be.eql(1);
        return hotelClerk.addSubscription(request);
      })
      .then(result => {
        should(result).match(response);
        should(hotelClerk.roomsCount).be.eql(1);
      });
  });

  it('should reject when Koncorde throws an error', () => {
    kuzzle.koncorde.normalize.rejects(new Error('test'));

    return should(hotelClerk.addSubscription(request)).be.rejected();
  });

  it('should reject with an error if no index is provided', () => {
    request.input.resource.index = null;
    return should(hotelClerk.addSubscription(request)).be.rejectedWith(BadRequestError);
  });

  it('should reject with an error if no collection is provided', () => {
    request.input.resource.collection = null;

    return should(hotelClerk.addSubscription(request)).be.rejectedWith(BadRequestError);
  });

  it('should allow subscribing with an empty filter', () => {
    request.input.body = {};

    return hotelClerk.addSubscription(request)
      .then(() => {
        should(hotelClerk.roomsCount).be.eql(1);
      });
  });

  it('should allow to subscribe to an existing room', () => {
    let roomId;

    return hotelClerk.addSubscription(request)
      .then(result => {
        should(result).be.an.Object();
        should(result).have.property('channel');
        should(result).have.property('roomId');
        should(hotelClerk.roomsCount).be.eql(1);

        const request2 = new Request({
          index: 'foo',
          collection: 'bar',
          controller: 'realtime',
          action: 'join',
          body: {
            roomId: result.roomId
          }
        }, {connectionId: 'connection2', user: null});

        roomId = result.roomId;
        request2.input.body = {roomId};
        return hotelClerk.join(request2);
      })
      .then(result => {
        should(result).be.an.Object();
        should(result).have.property('roomId', roomId);
        should(result).have.property('channel');
        should(hotelClerk.roomsCount).be.eql(1);
      });
  });

  it('#join should throw if the room does not exist', () => {
    const joinRequest = new Request({
      index: 'foo',
      collection: 'bar',
      controller: 'realtime',
      action: 'join',
      body: {roomId: 'no way I can exist'}
    }, context);

    return should(() => hotelClerk.join(joinRequest)).throw(NotFoundError, {
      id: 'core.realtime.room_not_found'
    });
  });

  it('should reject the subscription if the given scope argument is incorrect', () => {
    request.input.args.scope = 'foo';

    return should(hotelClerk.addSubscription(request)).be.rejectedWith(BadRequestError);
  });

  it('should reject the subscription if the given users argument is incorrect', () => {
    request.input.args.users = 'foo';

    return should(hotelClerk.addSubscription(request)).be.rejectedWith(BadRequestError);
  });

  it('should reject the subscription if the number of minterms exceeds the configured limit', () => {
    kuzzle.config.limits.subscriptionMinterms = 8;

    const normalized = [];
    for (let i = 0; i < 9; i++) {
      normalized.push([]);
    }

    kuzzle.koncorde.normalize.returns(Bluebird.resolve({
      normalized,
      index: 'index',
      collection: 'collection',
      id: 'foobar',
    }));
    return hotelClerk.addSubscription(request)
      .then(() => {throw new Error('should not happen');})
      .catch(error => {
        should(error)
          .be.an.instanceof(SizeLimitError);
        should(error.id).eql('core.realtime.too_many_terms');
      });
  });

  it('should refuse a subscription if the rooms limit has been reached', () => {
    hotelClerk.roomsCount = kuzzle.config.limits.subscriptionRooms;

    return should(hotelClerk.addSubscription(request))
      .be.rejectedWith(SizeLimitError, { id: 'core.realtime.too_many_rooms' });
  });

  it('should impose no limit to the number of rooms if the limit is set to 0', () => {
    kuzzle.config.limits.subscriptionRooms = 0;
    hotelClerk.roomsCount = Number.MAX_SAFE_INTEGER - 1;

    return should(hotelClerk.addSubscription(request)).be.fulfilled();
  });

  it('should discard the request if the associated connection is no longer active', () => {
    kuzzle.router.isConnectionAlive.returns(false);
    hotelClerk._createRoom = sinon.stub().throws(new Error('Should not have been called'));

    return hotelClerk.addSubscription(request);
  });
});
