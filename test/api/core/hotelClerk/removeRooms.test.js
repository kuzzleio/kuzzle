var
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError,
  NotFoundError = require.main.require('kuzzle-common-objects').Errors.notFoundError,
  Kuzzle = require.main.require('lib/api/kuzzle');

describe('Test: hotelClerk.removeRooms', () => {
  var
    kuzzle,
    connection = {id: 'connectionid'},
    context,
    index = 'test',
    collection1 = 'user',
    collection2 = 'foo',
    filter1 = {
      equals: {
        firstName: 'Ada'
      }
    },
    filter2 = {
      equals: {
        name: 'foo'
      }
    };


  beforeEach(() => {
    kuzzle = new Kuzzle();

    context = {
      connection: connection,
      token: {
        user: ''
      }
    };

    sandbox.stub(kuzzle.internalEngine, 'get').resolves({});
    return kuzzle.services.init({whitelist: []});
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should reject an error if no index provided', () => {
    var requestObject = new RequestObject({
      controller: 'admin',
      action: 'removeRooms',
      index: undefined,
      collection: collection1,
      body: {}
    });

    return should(kuzzle.hotelClerk.removeRooms(requestObject)).rejectedWith(BadRequestError);
  });

  it('should reject an error if no collection provided', () => {
    var requestObject = new RequestObject({
      controller: 'admin',
      action: 'removeRooms',
      index: index,
      collection: undefined,
      body: {}
    });

    return should(kuzzle.hotelClerk.removeRooms(requestObject)).rejectedWith(BadRequestError);
  });

  it('should reject an error if there is no subscription on this index', () => {
    var requestObject = new RequestObject({
      controller: 'admin',
      action: 'removeRooms',
      index: index,
      collection: collection1,
      body: {}
    });

    return should(kuzzle.hotelClerk.removeRooms(requestObject)).rejectedWith(NotFoundError);
  });

  it('should reject an error if there is no subscription on this collection', () => {
    var
      requestObjectSubscribe = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        index: index,
        collection: collection1,
        body: {}
      }),
      requestObject = new RequestObject({
        controller: 'admin',
        action: 'removeRooms',
        index: index,
        collection: collection2,
        body: {}
      });

    return kuzzle.hotelClerk.addSubscription(requestObjectSubscribe, context)
      .then(() => {
        return should(kuzzle.hotelClerk.removeRooms(requestObject)).rejectedWith(NotFoundError);
      });
  });

  it('should remove room in global subscription for provided collection', () => {
    var
      requestObjectSubscribe = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        index: index,
        collection: collection1,
        body: {}
      }),
      requestObjectRemove = new RequestObject({
        controller: 'admin',
        action: 'removeRooms',
        index: index,
        collection: collection1,
        body: {}
      });

    return kuzzle.hotelClerk.addSubscription(requestObjectSubscribe, context)
      .then(() => kuzzle.hotelClerk.removeRooms(requestObjectRemove))
      .then(response => {
        should(response).have.property('acknowledge');
        should(response.acknowledge).be.true();

        should(kuzzle.hotelClerk.rooms).be.empty().Object();
        should(kuzzle.dsl.filters.filtersTree).be.empty().Object();
      });
  });

  it('should remove room for subscription with filter for provided collection', () => {
    var
      requestObjectSubscribe = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        index: index,
        collection: collection1,
        body: filter1
      }),
      requestObjectRemove = new RequestObject({
        controller: 'admin',
        action: 'removeRooms',
        index: index,
        collection: collection1,
        body: {}
      });

    return kuzzle.hotelClerk.addSubscription(requestObjectSubscribe, context)
      .then(() => kuzzle.hotelClerk.removeRooms(requestObjectRemove))
      .then(response => {
        should(response).have.property('acknowledge');
        should(response.acknowledge).be.true();

        should(kuzzle.hotelClerk.rooms).be.empty().Object();
        should(kuzzle.dsl.filters.filtersTree).be.empty().Object();
      });
  });

  it('should remove room for global and filter subscription provided collection', () => {
    var
      requestObjectSubscribeGlobal = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        index: index,
        collection: collection1,
        body: {}
      }),
      requestObjectSubscribeFilter = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        index: index,
        collection: collection1,
        body: filter1
      }),
      requestObjectRemove = new RequestObject({
        controller: 'admin',
        action: 'removeRooms',
        index: index,
        collection: collection1,
        body: {}
      });

    return kuzzle.hotelClerk.addSubscription(requestObjectSubscribeGlobal, context)
      .then(() => kuzzle.hotelClerk.addSubscription(requestObjectSubscribeFilter, context))
      .then(() => kuzzle.hotelClerk.removeRooms(requestObjectRemove))
      .then(response => {
        should(response).have.property('acknowledge');
        should(response.acknowledge).be.true();

        should(kuzzle.hotelClerk.rooms).be.empty().Object();
        should(kuzzle.dsl.filters.filtersTree).be.empty().Object();
      });
  });

  it('should remove only room for provided collection', () => {
    var
      requestObjectSubscribeCollection1 = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        index: index,
        collection: collection1,
        body: {}
      }),
      requestObjectSubscribeCollection2 = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        index: index,
        collection: collection2,
        body: {}
      }),
      requestObjectRemove = new RequestObject({
        controller: 'admin',
        action: 'removeRooms',
        index: index,
        collection: collection1,
        body: {}
      });

    return kuzzle.hotelClerk.addSubscription(requestObjectSubscribeCollection1, context)
      .then(() => kuzzle.hotelClerk.addSubscription(requestObjectSubscribeCollection2, context))
      .then(() => kuzzle.hotelClerk.removeRooms(requestObjectRemove))
      .then(response => {
        should(response).have.property('acknowledge');
        should(response.acknowledge).be.true();

        should(kuzzle.hotelClerk.rooms).be.Object();
        should(Object.keys(kuzzle.hotelClerk.rooms).length).be.exactly(1);

        should(kuzzle.dsl.filters.filtersTree).be.Object();
        should(Object.keys(kuzzle.dsl.filters.filtersTree).length).be.exactly(1);
        should(Object.keys(kuzzle.dsl.filters.filtersTree[index]).length).be.exactly(1);
        should(kuzzle.dsl.filters.filtersTree[index][collection1]).be.undefined();
        should(kuzzle.dsl.filters.filtersTree[index][collection2]).be.Object();
      });
  });

  it('should reject an error if room is provided but is not an array', () => {
    var
      requestObjectSubscribeCollection1 = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        index: index,
        collection: collection1,
        body: {}
      }),
      requestObjectRemove = new RequestObject({
        controller: 'admin',
        action: 'removeRooms',
        index: index,
        collection: collection1,
        body: {rooms: {}}
      });

    return kuzzle.hotelClerk.addSubscription(requestObjectSubscribeCollection1, context)
      .then(() => {
        return should(kuzzle.hotelClerk.removeRooms(requestObjectRemove)).be.rejectedWith(BadRequestError);
      });
  });

  it('should remove only listed rooms for the collection', () => {
    var
      roomId = '3018d23a7d0400aaff4c2dadbcd2c3e1',
      requestObjectSubscribeFilter1 = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        requestId: roomId,
        index: index,
        collection: collection1,
        body: filter1
      }),
      requestObjectSubscribeFilter2 = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        requestId: roomId,
        index: index,
        collection: collection1,
        body: filter2
      }),
      requestObjectRemove = new RequestObject({
        controller: 'admin',
        action: 'removeRooms',
        requestId: roomId,
        index: index,
        collection: collection1,
        body: {rooms: [roomId]}
      });

    return kuzzle.hotelClerk.addSubscription(requestObjectSubscribeFilter1, context)
      .then(() => kuzzle.hotelClerk.addSubscription(requestObjectSubscribeFilter2, context))
      .then(() => kuzzle.hotelClerk.removeRooms(requestObjectRemove))
      .then(() => {
        should(Object.keys(kuzzle.hotelClerk.rooms).length).be.exactly(1);
        should(kuzzle.hotelClerk.rooms[roomId]).be.undefined();
      });
  });

  it('should return a response with partial error if a roomId doesn\'t correspond to the index', () => {
    var
      index2RoomName = 'e6255f81a2934ad02636a8ebf533dd46',
      requestObjectSubscribe1 = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        index: index,
        collection: collection1,
        body: {}
      }),
      requestObjectSubscribe2 = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        index: 'index2',
        collection: collection1,
        body: {}
      }),
      requestObjectRemove = new RequestObject({
        controller: 'admin',
        action: 'removeRooms',
        index: index,
        collection: collection1,
        body: {rooms: [index2RoomName]}
      });

    return kuzzle.hotelClerk.addSubscription(requestObjectSubscribe1, context)
      .then(() => kuzzle.hotelClerk.addSubscription(requestObjectSubscribe2, context))
      .then(() => kuzzle.hotelClerk.removeRooms(requestObjectRemove))
      .then((response) => {
        should(response.acknowledge).be.true();
        should(response.partialErrors.length).be.exactly(1);
        should(response.partialErrors).be.an.Array().and.match([`The room ${index2RoomName} does not match index ${index}`]);
      });
  });

  it('should return a response with partial error if a roomId doesn\'t correspond to the collection', () => {
    var
      collection2RoomName = '36a737bfc8da2f3c1673137a3b159d4a',
      requestObjectSubscribe1 = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        index: index,
        collection: collection1,
        body: {}
      }),
      requestObjectSubscribe2 = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        index: index,
        collection: collection2,
        body: {}
      }),
      requestObjectRemove = new RequestObject({
        controller: 'admin',
        action: 'removeRooms',
        index: index,
        collection: collection1,
        body: {rooms: [collection2RoomName]}
      });

    return kuzzle.hotelClerk.addSubscription(requestObjectSubscribe1, context)
      .then(() => kuzzle.hotelClerk.addSubscription(requestObjectSubscribe2, context))
      .then(() => kuzzle.hotelClerk.removeRooms(requestObjectRemove))
      .then((response) => {
        should(response.acknowledge).be.true();
        should(response.partialErrors.length).be.exactly(1);
        should(response.partialErrors).be.an.Array().and.match([`The room ${collection2RoomName} does not match collection ${collection1}`]);
      });
  });

  it('should return a response with partial error if a roomId doesn\'t exist', () => {
    var
      badRoomName = 'badRoomId',
      requestObjectSubscribe = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        index: index,
        collection: collection1,
        body: {}
      }),
      requestObjectRemove = new RequestObject({
        controller: 'admin',
        action: 'removeRooms',
        index: index,
        collection: collection1,
        body: {rooms: [badRoomName]}
      });

    return kuzzle.hotelClerk.addSubscription(requestObjectSubscribe, context)
      .then(() => kuzzle.hotelClerk.removeRooms(requestObjectRemove))
      .then(response => {
        should(response.acknowledge).be.true();
        should(response.partialErrors.length).be.exactly(1);
        should(response.partialErrors).be.an.Array().and.match(['No room with id ' + badRoomName]);
      });
  });
});
