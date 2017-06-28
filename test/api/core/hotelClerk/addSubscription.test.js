'use strict';

const
  should = require('should'),
  Bluebird = require('bluebird'),
  Request = require('kuzzle-common-objects').Request,
  HotelClerk = require('../../../../lib/api/core/hotelClerk'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  KuzzleMock = require('../../../mocks/kuzzle.mock');

describe('Test: hotelClerk.addSubscription', () => {
  let
    kuzzle,
    roomId,
    channel,
    connectionId = 'connectionid',
    context,
    roomName = 'roomName',
    index = 'test',
    collection = 'user',
    filter = {
      equals: {
        firstName: 'Ada'
      }
    };

  beforeEach(() => {
    context = {
      connectionId,
      token: null
    };
    kuzzle = new KuzzleMock();
    kuzzle.hotelClerk = new HotelClerk(kuzzle);

    kuzzle.dsl.register.returns(Bluebird.resolve({
      id: 'roomId',
      diff: 'diff'
    }));
  });

  it('should have object customers and rooms empty', () => {
    should(kuzzle.hotelClerk.rooms).be.an.Object();
    should(kuzzle.hotelClerk.rooms).be.empty();

    should(kuzzle.hotelClerk.customers).be.an.Object();
    should(kuzzle.hotelClerk.customers).be.empty();
  });

  it('should have the new room and customer', () => {
    const request = new Request({
      controller: 'realtime',
      action: 'subscribe',
      requestId: roomName,
      index: index,
      collection: collection,
      body: filter,
      volatile: {
        foo: 'bar',
        bar: [ 'foo', 'bar', 'baz', 'qux']
      }
    }, context);

    return kuzzle.hotelClerk.addSubscription(request)
      .then(response => {
        should(kuzzle.hotelClerk.rooms).be.an.Object();
        should(kuzzle.hotelClerk.rooms).not.be.empty();

        should(kuzzle.hotelClerk.customers).be.an.Object();
        should(kuzzle.hotelClerk.customers).not.be.empty();

        should(response).be.an.Object();
        should(response).have.property('roomId');
        should(response).have.property('channel');
        should(kuzzle.hotelClerk.rooms[response.roomId]).be.an.Object();
        should(kuzzle.hotelClerk.rooms[response.roomId]).not.be.empty();

        roomId = kuzzle.hotelClerk.rooms[response.roomId].id;

        const customer = kuzzle.hotelClerk.customers[connectionId];
        should(customer).be.an.Object();
        should(customer).not.be.empty();
        should(customer[roomId]).not.be.undefined().and.match(request.input.volatile);

        should(kuzzle.hotelClerk.rooms[roomId].channels).be.an.Object().and.not.be.undefined();
        should(Object.keys(kuzzle.hotelClerk.rooms[roomId].channels).length).be.exactly(1);

        channel = Object.keys(kuzzle.hotelClerk.rooms[roomId].channels)[0];
        should(kuzzle.hotelClerk.rooms[roomId].channels[channel].scope).not.be.undefined().and.be.exactly('all');
        should(kuzzle.hotelClerk.rooms[roomId].channels[channel].state).not.be.undefined().and.be.exactly('done');
        should(kuzzle.hotelClerk.rooms[roomId].channels[channel].users).not.be.undefined().and.be.exactly('none');
      });
  });

  it('should return the same response when the user has already subscribed to the filter', done => {
    const request = new Request({
      controller: 'realtime',
      collection: collection,
      index: index,
      body: filter
    }, context);
    let response;

    kuzzle.hotelClerk.addSubscription(request)
      .then(result => {
        response = result;
        return kuzzle.hotelClerk.addSubscription(request);
      })
      .then(result => {
        should(result).match(response);
        done();
      });
  });

  it('should reject an error when a filter is unknown', () => {
    let
      pAddSubscription,
      request = new Request({
        controller: 'realtime',
        action: 'subscribe',
        collection: collection,
        index: index,
        body: {badkeyword : {firstName: 'Ada'}}
      }, context);
    kuzzle.dsl.normalize.returns(Bluebird.reject(new Error('test')));

    pAddSubscription = kuzzle.hotelClerk.addSubscription(request);
    return should(pAddSubscription).be.rejected();
  });

  it('should reject with an error if no index is provided', () => {
    const request = new Request({
      controller: 'realtime',
      action: 'subscribe',
      collection,
      body: {}
    }, context);

    const pAddSubscription = kuzzle.hotelClerk.addSubscription(request);
    return should(pAddSubscription).be.rejectedWith(BadRequestError);
  });

  it('should reject with an error if no collection is provided', () => {
    const request = new Request({
      controller: 'realtime',
      action: 'subscribe',
      index,
      body: {}
    }, context);

    const pAddSubscription = kuzzle.hotelClerk.addSubscription(request);
    return should(pAddSubscription).be.rejectedWith(BadRequestError);
  });


  it('should return the same room ID if the same filters are used', () => {
    const
      request1 = new Request({
        controller: 'realtime',
        collection: collection,
        index: index,
        body: {
          not: {
            or: [
              {
                equals: {
                  firstName: 'Ada'
                },
              },
              {
                exists: {
                  field: 'lastName'
                }
              }
            ]
          }
        }
      }, context),
      request2 = new Request({
        controller: 'realtime',
        collection: collection,
        index: index,
        body: {
          and: [
            {
              not: {
                exists: {
                  field: 'lastName'
                }
              }
            },
            {
              not: {
                equals: {
                  firstName: 'Ada'
                }
              }
            }
          ]
        }
      }, context);
    let response;

    return kuzzle.hotelClerk.addSubscription(request1)
      .then(result => {
        response = result;
        return kuzzle.hotelClerk.addSubscription(request2);
      })
      .then(result => {
        should(result.roomId).be.exactly(response.roomId);
      });
  });

  it('should allow subscribing with an empty filter', () => {
    const
      request = new Request({
        controller: 'realtime',
        index: index,
        collection: collection
      }, context);

    return should(kuzzle.hotelClerk.addSubscription(request)).be.fulfilled();
  });

  it('should allow to subscribe to an existing room', () => {
    const
      request1 = new Request({
        controller: 'realtime',
        index: index,
        collection: collection
      }, {connectionId: 'connection1', user: null});
    let anotherRoomId;

    return kuzzle.hotelClerk.addSubscription(request1)
      .then(result => {
        should(result).be.an.Object();
        should(result).have.property('channel');
        should(result).have.property('roomId');

        return result.roomId;
      })
      .then(id => {
        const request2 = new Request({
          collection: collection,
          index: index,
          controller: 'realtime',
          action: 'join',
          body: {
            roomId: id
          }
        }, {connectionId: 'connection2', user: null});

        anotherRoomId = id;
        request2.input.body = {roomId: anotherRoomId};
        return kuzzle.hotelClerk.join(request2);
      })
      .then(result => {
        should(result).be.an.Object();
        should(result).have.property('roomId', anotherRoomId);
        should(result).have.property('channel');
      });
  });

  it('#join should throw if the room does not exist', () => {
    const request = new Request({
      collection: collection,
      index: index,
      controller: 'realtime',
      action: 'join',
      body: {roomId: 'no way I can exist'}
    }, context);

    return should(() => kuzzle.hotelClerk.join(request))
      .throw(NotFoundError);
  });

  it('should reject the subscription if the given state argument is incorrect', () => {
    const request = new Request({
      collection: collection,
      controller: 'realtime',
      action: 'subscribe',
      body: {},
      state: 'foo'
    }, context);

    return should(kuzzle.hotelClerk.addSubscription(request)).be.rejectedWith(BadRequestError);
  });

  it('should reject the subscription if the given scope argument is incorrect', () => {
    const request = new Request({
      collection: collection,
      controller: 'realtime',
      action: 'subscribe',
      body: {},
      scope: 'foo'
    }, context);

    return should(kuzzle.hotelClerk.addSubscription(request)).be.rejectedWith(BadRequestError);
  });

  it('should reject the subscription if the given users argument is incorrect', () => {
    const request = new Request({
      collection: collection,
      controller: 'realtime',
      action: 'subscribe',
      body: {},
      users: 'foo'
    }, context);

    return should(kuzzle.hotelClerk.addSubscription(request)).be.rejectedWith(BadRequestError);
  });

  it('should treat null/undefined filters as empty filters', () => {
    const
      request1 = new Request({
        controller: 'realtime',
        collection: collection,
        index: index,
        body: {}
      }, context),
      request2 = new Request({
        controller: 'realtime',
        collection: collection,
        index: index,
        body: null
      }, context);
    let response;

    return kuzzle.hotelClerk.addSubscription(request1)
      .then(result => {
        response = result;
        return kuzzle.hotelClerk.addSubscription(request2);
      })
      .then(result => {
        should(result.roomId).be.exactly(response.roomId);
      });
  });
});
