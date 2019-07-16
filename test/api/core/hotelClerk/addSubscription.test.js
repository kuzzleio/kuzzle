'use strict';

const
  should = require('should'),
  sinon = require('sinon'),
  Bluebird = require('bluebird'),
  Request = require('kuzzle-common-objects').Request,
  HotelClerk = require('../../../../lib/api/core/hotelClerk'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  {
    BadRequestError,
    NotFoundError,
    SizeLimitError
  } = require('kuzzle-common-objects').errors;

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
  });
  
  it('should initialize base structures', () => {
    should(hotelClerk.rooms).be.an.Object().and.be.empty();
    should(hotelClerk.customers).be.an.Object().and.be.empty();
    should(hotelClerk.roomsCount).be.a.Number().and.be.eql(0);
  });

  it('should register a new room and customer', () => {
    kuzzle.realtime.normalize
      .onFirstCall().returns(Bluebird.resolve({id: 'foobar'}))
      .onSecondCall().returns(Bluebird.resolve({id: 'barfoo'}));

    kuzzle.realtime.store
      .onFirstCall().returns({id: 'foobar'})
      .onSecondCall().returns({id: 'barfoo'});

    return hotelClerk.addSubscription(request)
      .then(response => {
        should(kuzzle.realtime.normalize).calledOnce();
        should(kuzzle.realtime.store).calledOnce();
        should(response.roomId).be.eql('foobar');
        should(response).have.property('channel');

        should(hotelClerk.roomsCount).be.eql(1);

        const roomId = hotelClerk.rooms[response.roomId].id;
        const customer = hotelClerk.customers[connectionId];

        should(customer).be.an.Object();
        should(customer[roomId]).not.be.undefined().and.match(request.input.volatile);

        should(hotelClerk.rooms[roomId].channels).be.an.Object().and.not.be.undefined();
        should(Object.keys(hotelClerk.rooms[roomId].channels).length).be.exactly(1);

        const channel = Object.keys(hotelClerk.rooms[roomId].channels)[0];
        should(hotelClerk.rooms[roomId].channels[channel].scope).be.exactly('all');
        should(hotelClerk.rooms[roomId].channels[channel].state).be.exactly('done');
        should(hotelClerk.rooms[roomId].channels[channel].users).be.exactly('none');

        return hotelClerk.addSubscription(request);
      })
      .then(response => {
        should(kuzzle.realtime.normalize.callCount).be.eql(2);
        should(kuzzle.realtime.store.callCount).be.eql(2);
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
    kuzzle.realtime.normalize.rejects(new Error('test'));

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

    return should(() => hotelClerk.join(joinRequest)).throw(NotFoundError);
  });

  it('should reject the subscription if the given state argument is incorrect', () => {
    request.input.args.state = 'foo';

    return hotelClerk.addSubscription(request)
      .catch((e) => {
        should(e).be.instanceOf(BadRequestError);
      });
  });

  it('should reject the subscription if the given scope argument is incorrect', () => {
    request.input.args.scope = 'foo';

    return hotelClerk.addSubscription(request)
      .catch((e) => {
        should(e).be.instanceOf(BadRequestError);
      });
  });

  it('should reject the subscription if the given users argument is incorrect', () => {
    request.input.args.users = 'foo';

    return hotelClerk.addSubscription(request)
      .catch((e) => {
        should(e).be.instanceOf(BadRequestError);
      });
  });

  it('should reject the subscription if the number of minterms exceeds the configured limit', () => {
    kuzzle.config.limits.subscriptionMinterms = 8;

    const normalized = [];
    for (let i = 0; i < 9; i++) {
      normalized.push([]);
    }

    kuzzle.realtime.normalize.returns(Bluebird.resolve({
      normalized,
      index: 'index',
      collection: 'collection',
      id: 'foobar',
    }));
    return hotelClerk.addSubscription(request)
      .catch(error => {
        should(error)
          .be.an.instanceof(SizeLimitError);
        should(error.message)
          .eql('Unable to subscribe: maximum number of minterms exceeded (max 8, received 9).');
      });
  });

  it('should refuse a subscription if the rooms limit has been reached', () => {
    hotelClerk.roomsCount = kuzzle.config.limits.subscriptionRooms;

    return hotelClerk.addSubscription(request)
      .catch((e) => {
        should(e).be.instanceOf(SizeLimitError);
      });
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
