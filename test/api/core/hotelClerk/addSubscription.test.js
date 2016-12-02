var
  should = require('should'),
  Promise = require('bluebird'),
  Request = require('kuzzle-common-objects').Request,
  HotelClerk = require('../../../../lib/api/core/hotelClerk'),
  InternalError = require('kuzzle-common-objects').errors.InternalError,
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  Kuzzle = require('../../../mocks/kuzzle.mock');

describe('Test: hotelClerk.addSubscription', () => {
  var
    kuzzle,
    roomId,
    channel,
    connection = {id: 'connectionid'},
    context = {
      connection: connection,
      token: null
    },
    roomName = 'roomName',
    index = 'test',
    collection = 'user',
    filter = {
      equals: {
        firstName: 'Ada'
      }
    };

  beforeEach(() => {
    kuzzle = new Kuzzle();
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
    var requestObject = new Request({
      controller: 'subscribe',
      action: 'on',
      requestId: roomName,
      index: index,
      collection: collection,
      body: filter,
      metadata: {
        foo: 'bar',
        bar: [ 'foo', 'bar', 'baz', 'qux']
      }
    });

    return kuzzle.hotelClerk.addSubscription(requestObject, context)
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

          customer = kuzzle.hotelClerk.customers[connection.id];
          should(customer).be.an.Object();
          should(customer).not.be.empty();
          should(customer[roomId]).not.be.undefined().and.match(requestObject.metadata);

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
    var requestObject = new Request({
      controller: 'subscribe',
      collection: collection,
      index: index,
      body: filter
    });

    return kuzzle.hotelClerk.addSubscription(requestObject, context)
      .then(() => {
        var data;

        should(kuzzle.pluginsManager.trigger)
          .be.calledWith('proxy:joinChannel');

        data = kuzzle.pluginsManager.trigger.secondCall.args[1];

        should(data).be.an.Object();
        should(data.channel).be.a.String();
        should(data.id).be.eql(context.connection.id);
      });
  });

  it('should return the same response when the user has already subscribed to the filter', done => {
    var requestObject = new Request({
      controller: 'subscribe',
      collection: collection,
      index: index,
      body: filter
    });
    var response;

    kuzzle.hotelClerk.addSubscription(requestObject, context)
      .then(result => {
        response = result;
        return kuzzle.hotelClerk.addSubscription(requestObject, context);
      })
      .then(result => {
        should(result).match(response);
        done();
      });
  });

  it('should reject an error when a filter is unknown', () => {
    var
      pAddSubscription,
      requestObject = new Request({
        controller: 'subscribe',
        action: 'on',
        collection: collection,
        index: index,
        body: {badkeyword : {firstName: 'Ada'}}
      });
    kuzzle.dsl.register.returns(Promise.reject(new Error('test')));

    pAddSubscription = kuzzle.hotelClerk.addSubscription(requestObject, context);
    return should(pAddSubscription).be.rejected();
  });

  it('should reject with an error if no index is provided', () => {
    var
      pAddSubscription,
      requestObject = new Request({
        controller: 'subscribe',
        action: 'on',
        collection,
        body: {}
      });

    pAddSubscription = kuzzle.hotelClerk.addSubscription(requestObject, context);
    return should(pAddSubscription).be.rejectedWith(BadRequestError);
  });

  it('should reject with an error if no collection is provided', () => {
    var
      pAddSubscription,
      requestObject = new Request({
        controller: 'subscribe',
        action: 'on',
        index,
        body: {}
      });

    pAddSubscription = kuzzle.hotelClerk.addSubscription(requestObject, context);
    return should(pAddSubscription).be.rejectedWith(BadRequestError);
  });


  it('should return the same room ID if the same filters are used', done => {
    var
      requestObject1 = new Request({
        controller: 'subscribe',
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
      }),
      requestObject2 = new Request({
        controller: 'subscribe',
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
      }),
      response;

    kuzzle.hotelClerk.addSubscription(requestObject1, context)
      .then(result => {
        response = result;
        return kuzzle.hotelClerk.addSubscription(requestObject2, context);
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
      requestObject = new Request({
        controller: 'subscribe',
        index: index,
        collection: collection
      });

    delete requestObject.data.body;

    return should(kuzzle.hotelClerk.addSubscription(requestObject, context)).be.fulfilled();
  });

  it('should delay a room creation if it has been marked for destruction', done => {
    var
      requestObject = new Request({
        controller: 'subscribe',
        index: index,
        collection: collection
      });

    kuzzle.hotelClerk.addSubscription(requestObject, context)
      .then(response => {
        kuzzle.hotelClerk.rooms[response.roomId].destroyed = true;

        kuzzle.hotelClerk.addSubscription(requestObject, {connection: {id: 'anotherID'}, user: null})
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
      requestObject1 = new Request({
        controller: 'subscribe',
        index: index,
        collection: collection
      });

    kuzzle.hotelClerk.addSubscription(requestObject1, {connection: 'connection1', user: null})
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
        var requestObject2 = new Request({
          collection: collection,
          index: index,
          controller: 'subscribe',
          action: 'join',
          body: {
            roomId: id
          }
        });

        anotherRoomId = id;
        requestObject2.body = {roomId: anotherRoomId};
        return kuzzle.hotelClerk.join(requestObject2, {connection: 'connection2', user: null});
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
    return should(kuzzle.hotelClerk.join(
      new Request({
        collection: collection,
        index: index,
        controller: 'subscribe',
        action: 'join',
        body: {roomId: 'no way I can exist'}
      }),
      context
    ))
      .be.rejectedWith(InternalError);
  });

  it('should reject the subscription if the given state argument is incorrect', () => {
    return should(kuzzle.hotelClerk.addSubscription(
      new Request({
        collection: collection,
        controller: 'subscribe',
        action: 'on',
        body: {},
        state: 'foo'
      }),
      context
    ))
      .be.rejectedWith(BadRequestError);
  });

  it('should reject the subscription if the given scope argument is incorrect', () => {
    return should(kuzzle.hotelClerk.addSubscription(
      new Request({
        collection: collection,
        controller: 'subscribe',
        action: 'on',
        body: {},
        scope: 'foo'
      }),
      context
    ))
      .be.rejectedWith(BadRequestError);
  });

  it('should reject the subscription if the given users argument is incorrect', () => {
    return should(kuzzle.hotelClerk.addSubscription(
      new Request({
        collection: collection,
        controller: 'subscribe',
        action: 'on',
        body: {},
        users: 'foo'
      }),
      context
    ))
      .be.rejectedWith(BadRequestError);
  });

  it('should treat null/undefined filters as empty filters', done => {
    var
      requestObject1 = new Request({
        controller: 'subscribe',
        collection: collection,
        index: index,
        body: {}
      }),
      requestObject2 = new Request({
        controller: 'subscribe',
        collection: collection,
        index: index,
        body: null
      }),
      response;

    kuzzle.hotelClerk.addSubscription(requestObject1, context)
      .then(result => {
        response = result;
        return kuzzle.hotelClerk.addSubscription(requestObject2, context);
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
