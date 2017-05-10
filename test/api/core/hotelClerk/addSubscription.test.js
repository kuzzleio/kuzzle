'use strict';

const
  should = require('should'),
  Promise = require('bluebird'),
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

    kuzzle.dsl.register.returns(Promise.resolve({
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
    var request = new Request({
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
        var customer;

        try {
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

          customer = kuzzle.hotelClerk.customers[connectionId];
          should(customer).be.an.Object();
          should(customer).not.be.empty();
          should(customer[roomId]).not.be.undefined().and.match(request.input.volatile);

          should(kuzzle.hotelClerk.rooms[roomId].channels).be.an.Object().and.not.be.undefined();
          should(Object.keys(kuzzle.hotelClerk.rooms[roomId].channels).length).be.exactly(1);

          channel = Object.keys(kuzzle.hotelClerk.rooms[roomId].channels)[0];
          should(kuzzle.hotelClerk.rooms[roomId].channels[channel].scope).not.be.undefined().and.be.exactly('all');
          should(kuzzle.hotelClerk.rooms[roomId].channels[channel].state).not.be.undefined().and.be.exactly('done');
          should(kuzzle.hotelClerk.rooms[roomId].channels[channel].users).not.be.undefined().and.be.exactly('none');

          return Promise.resolve();
        }
        catch (error) {
          return Promise.reject(error);
        }
      });
  });

  it('should trigger a proxy:joinChannel hook', () => {
    var request = new Request({
      controller: 'realtime',
      collection: collection,
      index: index,
      body: filter
    }, context);

    return kuzzle.hotelClerk.addSubscription(request)
      .then(() => {
        var data;

        should(kuzzle.pluginsManager.trigger)
          .be.calledWith('proxy:joinChannel');

        data = kuzzle.pluginsManager.trigger.secondCall.args[1];

        should(data).be.an.Object();
        should(data.channel).be.a.String();
        should(data.connectionId).be.eql(context.connectionId);
      });
  });

  it('should return the same response when the user has already subscribed to the filter', done => {
    var request = new Request({
      controller: 'realtime',
      collection: collection,
      index: index,
      body: filter
    }, context);
    var response;

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
    kuzzle.dsl.register.returns(Promise.reject(new Error('test')));

    pAddSubscription = kuzzle.hotelClerk.addSubscription(request);
    return should(pAddSubscription).be.rejected();
  });

  it('should reject with an error if no index is provided', () => {
    var
      pAddSubscription,
      request = new Request({
        controller: 'realtime',
        action: 'subscribe',
        collection,
        body: {}
      }, context);

    pAddSubscription = kuzzle.hotelClerk.addSubscription(request);
    return should(pAddSubscription).be.rejectedWith(BadRequestError);
  });

  it('should reject with an error if no collection is provided', () => {
    var
      pAddSubscription,
      request = new Request({
        controller: 'realtime',
        action: 'subscribe',
        index,
        body: {}
      }, context);

    pAddSubscription = kuzzle.hotelClerk.addSubscription(request);
    return should(pAddSubscription).be.rejectedWith(BadRequestError);
  });


  it('should return the same room ID if the same filters are used', done => {
    var
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
      }, context),
      response;

    kuzzle.hotelClerk.addSubscription(request1)
      .then(result => {
        response = result;
        return kuzzle.hotelClerk.addSubscription(request2);
      })
      .then(result => {
        should(result.roomId).be.exactly(response.roomId);
        done();
      })
      .catch(error => {
        done(error);
      });
  });

  it('should allow subscribing with an empty filter', () => {
    var
      request = new Request({
        controller: 'realtime',
        index: index,
        collection: collection
      }, context);

    return should(kuzzle.hotelClerk.addSubscription(request)).be.fulfilled();
  });

  it('should delay a room creation if it has been marked for destruction', done => {
    var
      request1 = new Request({
        controller: 'realtime',
        index: index,
        collection: collection
      }, context),
      request2 = new Request({
        controller: 'realtime',
        index: index,
        collection: collection
      }, {connectionId: 'anotherID', user: null});

    kuzzle.hotelClerk.addSubscription(request1)
      .then(response => {
        kuzzle.hotelClerk.rooms[response.roomId].destroyed = true;

        kuzzle.hotelClerk.addSubscription(request2)
          .then(recreated => {
            should(recreated.roomId).be.exactly(response.roomId);
            should(kuzzle.hotelClerk.rooms[recreated.roomId].destroyed).be.undefined();
            should(kuzzle.hotelClerk.rooms[recreated.roomId].customers.length).be.exactly(1);
            should(kuzzle.hotelClerk.rooms[recreated.roomId].customers).match(['anotherID']);
            done();

            return null;
          })
          .catch(error => done(error));

        process.nextTick(() => delete kuzzle.hotelClerk.rooms[response.roomId]);

        return null;
      })
      .catch(error => done(error));
  });

  it('should allow to subscribe to an existing room', done => {
    var
      anotherRoomId,
      request1 = new Request({
        controller: 'realtime',
        index: index,
        collection: collection
      }, {connectionId: 'connection1', user: null});

    kuzzle.hotelClerk.addSubscription(request1)
      .then(result => {
        try {
          should(result).be.an.Object();
          should(result).have.property('channel');
          should(result).have.property('roomId');

          return Promise.resolve(result.roomId);
        }
        catch (error) {
          return Promise.reject(error);
        }
      })
      .then(id => {
        var request2 = new Request({
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
        try {
          should(result).be.an.Object();
          should(result).have.property('roomId', anotherRoomId);
          should(result).have.property('channel');
          done();

          return Promise.resolve();
        }
        catch (error) {
          return Promise.reject(error);
        }
      })
      .catch(error => {
        done(error);
      });

  });

  it('#join should reject the promise if the room does not exist', () => {
    const request = new Request({
      collection: collection,
      index: index,
      controller: 'realtime',
      action: 'join',
      body: {roomId: 'no way I can exist'}
    }, context);

    return should(kuzzle.hotelClerk.join(request))
      .be.rejectedWith(NotFoundError);
  });

  it('should reject the subscription if the given state argument is incorrect', () => {
    var request = new Request({
      collection: collection,
      controller: 'realtime',
      action: 'subscribe',
      body: {},
      state: 'foo'
    }, context);

    return should(kuzzle.hotelClerk.addSubscription(request)).be.rejectedWith(BadRequestError);
  });

  it('should reject the subscription if the given scope argument is incorrect', () => {
    var request = new Request({
      collection: collection,
      controller: 'realtime',
      action: 'subscribe',
      body: {},
      scope: 'foo'
    }, context);

    return should(kuzzle.hotelClerk.addSubscription(request)).be.rejectedWith(BadRequestError);
  });

  it('should reject the subscription if the given users argument is incorrect', () => {
    var request = new Request({
      collection: collection,
      controller: 'realtime',
      action: 'subscribe',
      body: {},
      users: 'foo'
    }, context);

    return should(kuzzle.hotelClerk.addSubscription(request)).be.rejectedWith(BadRequestError);
  });

  it('should treat null/undefined filters as empty filters', done => {
    var
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
      }, context),
      response;

    kuzzle.hotelClerk.addSubscription(request1)
      .then(result => {
        response = result;
        return kuzzle.hotelClerk.addSubscription(request2);
      })
      .then(result => {
        try {
          should(result.roomId).be.exactly(response.roomId);
          done();

          return Promise.resolve();
        }
        catch (error) {
          return Promise.reject(error);
        }
      })
      .catch(error => {
        done(error);
      });
  });
});
