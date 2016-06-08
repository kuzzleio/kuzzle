var
  should = require('should'),
  q = require('q'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError,
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError,
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle');

describe('Test: hotelClerk.addSubscription', function () {
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
      term: {
        firstName: 'Ada'
      }
    };

  beforeEach(() => {
    kuzzle = new Kuzzle();
    return kuzzle.start(params, {dummy: true});
  });

  it('should have object filtersTree, customers and rooms empty', function () {
    should(kuzzle.dsl.filters.filtersTree).be.an.Object();
    should(kuzzle.dsl.filters.filtersTree).be.empty();

    should(kuzzle.hotelClerk.rooms).be.an.Object();
    should(kuzzle.hotelClerk.rooms).be.empty();

    should(kuzzle.hotelClerk.customers).be.an.Object();
    should(kuzzle.hotelClerk.customers).be.empty();
  });

  it('should have the new room and customer', function () {
    var requestObject = new RequestObject({
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

        should(kuzzle.dsl.filters.filtersTree).be.an.Object();
        should(kuzzle.dsl.filters.filtersTree).not.be.empty();

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
      });
  });

  it('should trigger a protocol:joinChannel hook', function (done) {
    var requestObject = new RequestObject({
      controller: 'subscribe',
      collection: collection,
      index: index,
      body: filter
    });

    this.timeout(50);

    kuzzle.once('protocol:joinChannel', (data) => {
      should(data).be.an.Object();
      should(data.channel).be.a.String();
      should(data.id).be.eql(context.connection.id);
      done();
    });

    kuzzle.hotelClerk.addSubscription(requestObject, context);
  });

  it('should return the same response when the user has already subscribed to the filter', done => {
    var requestObject = new RequestObject({
      controller: 'subscribe',
      collection: collection,
      index: index,
      body: filter
    });
    var response;

    return kuzzle.hotelClerk.addSubscription(requestObject, context)
      .then(result => {
        response = result;
        return kuzzle.hotelClerk.addSubscription(requestObject, context);
      })
      .then(result => {
        should(result).match(response);
        done();
      });
  });

  it('should reject an error when a filter is unknown', function () {
    var
      pAddSubscription,
      requestObject = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        collection: collection,
        index: index,
        body: {badterm : {firstName: 'Ada'}}
      });

    pAddSubscription = kuzzle.hotelClerk.addSubscription(requestObject, context);
    return should(pAddSubscription).be.rejected();
  });

  it('should reject with an error if no index is provided', function () {
    var
      pAddSubscription,
      requestObject = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        collection,
        body: {}
      });

    pAddSubscription = kuzzle.hotelClerk.addSubscription(requestObject, context);
    return should(pAddSubscription).be.rejectedWith(BadRequestError);
  });

  it('should reject with an error if no collection is provided', function () {
    var
      pAddSubscription,
      requestObject = new RequestObject({
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
      requestObject1 = new RequestObject({
        controller: 'subscribe',
        collection: collection,
        index: index,
        body: {
          term: {
            firstName: 'Ada'
          },
          exists: {
            field: 'lastName'
          }
        }
      }),
      requestObject2 = new RequestObject({
        controller: 'subscribe',
        collection: collection,
        index: index,
        body: {
          exists: {
            field: 'lastName'
          },
          term: {
            firstName: 'Ada'
          }
        }
      }),
      response;

    return kuzzle.hotelClerk.addSubscription(requestObject1, context)
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

  it('should allow subscribing with an empty filter', function () {
    var
      requestObject = new RequestObject({
        controller: 'subscribe',
        index: index,
        collection: collection
      });

    delete requestObject.data.body;
    
    return should(kuzzle.hotelClerk.addSubscription(requestObject, context)).be.fulfilled();
  });

  it('should delay a room creation if it has been marked for destruction', function (done) {
    var
      requestObject = new RequestObject({
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
          })
          .catch(error => done(error));

        process.nextTick(() => delete kuzzle.hotelClerk.rooms[response.roomId]);
      })
      .catch(error => done(error));
  });

  it('should allow to subscribe to an existing room', done => {
    var
      roomId,
      requestObject1 = new RequestObject({
        controller: 'subscribe',
        index: index,
        collection: collection
      });

    kuzzle.hotelClerk.addSubscription(requestObject1, {connection: 'connection1', user: null})
      .then(result => {
        should(result).be.an.Object();
        should(result).have.property('channel');
        should(result).have.property('roomId');

        return q(result.roomId);
      })
      .then(id => {
        var requestObject2 = new RequestObject({
          collection: collection,
          index: index,
          controller: 'subscribe',
          action: 'join',
          body: {
            roomId: id
          }
        });

        roomId = id;
        requestObject2.body = {roomId: roomId};
        return kuzzle.hotelClerk.join(requestObject2, {connection: 'connection2', user: null});
      })
      .then(result => {
        should(result).be.an.Object();
        should(result).have.property('roomId', roomId);
        should(result).have.property('channel');
        done();
      })
      .catch(error => {
        done(error);
      });

  });

  it('#join should reject the promise if the room does not exist', () => {
    return should(kuzzle.hotelClerk.join(
      new RequestObject({
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

  it('should reject the subscription if the given state argument is incorrect', function () {
    return should(kuzzle.hotelClerk.addSubscription(
      new RequestObject({
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

  it('should reject the subscription if the given scope argument is incorrect', function () {
    return should(kuzzle.hotelClerk.addSubscription(
      new RequestObject({
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

  it('should reject the subscription if the given users argument is incorrect', function () {
    return should(kuzzle.hotelClerk.addSubscription(
      new RequestObject({
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

  it('should treat null/undefined filters as empty filters', function (done) {
    var
      requestObject1 = new RequestObject({
        controller: 'subscribe',
        collection: collection,
        index: index,
        body: {}
      }),
      requestObject2 = new RequestObject({
        controller: 'subscribe',
        collection: collection,
        index: index,
        body: null
      }),
      response;

    return kuzzle.hotelClerk.addSubscription(requestObject1, context)
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
});
