var
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Request = require('kuzzle-common-objects').Request,
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  Dsl = require('../../../../lib/api/dsl'),
  HotelClerk = require('../../../../lib/api/core/hotelClerk'),
  Kuzzle = require('../../../mocks/kuzzle.mock');

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
    kuzzle.hotelClerk = new HotelClerk(kuzzle);
    kuzzle.dsl = new Dsl();

    context = {
      connection: connection,
      token: {
        user: ''
      }
    };

  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should reject an error if no index provided', () => {
    var requestObject = new Request({
      controller: 'admin',
      action: 'removeRooms',
      index: undefined,
      collection: collection1,
      body: {}
    });

    return should(kuzzle.hotelClerk.removeRooms(requestObject)).rejectedWith(BadRequestError);
  });

  it('should reject an error if no collection provided', () => {
    var requestObject = new Request({
      controller: 'admin',
      action: 'removeRooms',
      index: index,
      collection: undefined,
      body: {}
    });

    return should(kuzzle.hotelClerk.removeRooms(requestObject)).rejectedWith(BadRequestError);
  });

  it('should reject an error if there is no subscription on this index', () => {
    var requestObject = new Request({
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
      requestObjectSubscribe = new Request({
        controller: 'subscribe',
        action: 'on',
        index: index,
        collection: collection1,
        body: {}
      }),
      requestObject = new Request({
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
      requestObjectSubscribe = new Request({
        controller: 'subscribe',
        action: 'on',
        index: index,
        collection: collection1,
        body: {}
      }),
      requestObjectRemove = new Request({
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
      });
  });

  it('should remove room for subscription with filter for provided collection', () => {
    var
      requestObjectSubscribe = new Request({
        controller: 'subscribe',
        action: 'on',
        index: index,
        collection: collection1,
        body: filter1
      }),
      requestObjectRemove = new Request({
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
      });
  });

  it('should remove room for global and filter subscription provided collection', () => {
    var
      requestObjectSubscribeGlobal = new Request({
        controller: 'subscribe',
        action: 'on',
        index: index,
        collection: collection1,
        body: {}
      }),
      requestObjectSubscribeFilter = new Request({
        controller: 'subscribe',
        action: 'on',
        index: index,
        collection: collection1,
        body: filter1
      }),
      requestObjectRemove = new Request({
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
      });
  });

  it('should remove only room for provided collection', () => {
    var
      requestObjectSubscribeCollection1 = new Request({
        controller: 'subscribe',
        action: 'on',
        index: index,
        collection: collection1,
        body: {}
      }),
      requestObjectSubscribeCollection2 = new Request({
        controller: 'subscribe',
        action: 'on',
        index: index,
        collection: collection2,
        body: {}
      }),
      requestObjectRemove = new Request({
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
      });
  });

  it('should reject an error if room is provided but is not an array', () => {
    var
      requestObjectSubscribeCollection1 = new Request({
        controller: 'subscribe',
        action: 'on',
        index: index,
        collection: collection1,
        body: {}
      }),
      requestObjectRemove = new Request({
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
      roomId,
      requestObjectSubscribeFilter1 = new Request({
        controller: 'subscribe',
        action: 'on',
        index: index,
        collection: collection1,
        body: filter1
      }),
      requestObjectSubscribeFilter2 = new Request({
        controller: 'subscribe',
        action: 'on',
        index: index,
        collection: collection1,
        body: filter2
      }),
      requestObjectRemove = new Request({
        controller: 'admin',
        action: 'removeRooms',
        index: index,
        collection: collection1,
        body: {rooms: []}
      });

    return kuzzle.hotelClerk.addSubscription(requestObjectSubscribeFilter1, context)
      .then(result => {
        roomId = result.roomId;
        requestObjectRemove.data.body.rooms.push(roomId);
        return kuzzle.hotelClerk.addSubscription(requestObjectSubscribeFilter2, context);
      })
      .then(() => kuzzle.hotelClerk.removeRooms(requestObjectRemove))
      .then(() => {
        should(Object.keys(kuzzle.hotelClerk.rooms).length).be.exactly(1);
        should(kuzzle.hotelClerk.rooms[roomId]).be.undefined();
      });
  });

  it('should return a response with partial error if a roomId doesn\'t correspond to the index', () => {
    var
      index2RoomName,
      requestObjectSubscribe1 = new Request({
        controller: 'subscribe',
        action: 'on',
        index: index,
        collection: collection1,
        body: {}
      }),
      requestObjectSubscribe2 = new Request({
        controller: 'subscribe',
        action: 'on',
        index: 'index2',
        collection: collection1,
        body: {}
      }),
      requestObjectRemove = new Request({
        controller: 'admin',
        action: 'removeRooms',
        index: index,
        collection: collection1,
        body: {rooms: []}
      });

    return kuzzle.hotelClerk.addSubscription(requestObjectSubscribe1, context)
      .then(() => kuzzle.hotelClerk.addSubscription(requestObjectSubscribe2, context))
      .then(result => {
        index2RoomName = result.roomId;
        requestObjectRemove.data.body.rooms.push(index2RoomName);
        return kuzzle.hotelClerk.removeRooms(requestObjectRemove);
      })
      .then((response) => {
        should(response.acknowledge).be.true();
        should(response.partialErrors.length).be.exactly(1);
        should(response.partialErrors).be.an.Array().and.match([`The room ${index2RoomName} does not match index ${index}`]);
      });
  });

  it('should return a response with partial error if a roomId doesn\'t correspond to the collection', () => {
    var
      collection2RoomName,
      requestObjectSubscribe1 = new Request({
        controller: 'subscribe',
        action: 'on',
        index: index,
        collection: collection1,
        body: {}
      }),
      requestObjectSubscribe2 = new Request({
        controller: 'subscribe',
        action: 'on',
        index: index,
        collection: collection2,
        body: {}
      }),
      requestObjectRemove = new Request({
        controller: 'admin',
        action: 'removeRooms',
        index: index,
        collection: collection1,
        body: {rooms: []}
      });

    return kuzzle.hotelClerk.addSubscription(requestObjectSubscribe1, context)
      .then(() => kuzzle.hotelClerk.addSubscription(requestObjectSubscribe2, context))
      .then(result => {
        collection2RoomName = result.roomId;
        requestObjectRemove.data.body.rooms.push(collection2RoomName);
        return kuzzle.hotelClerk.removeRooms(requestObjectRemove);
      })
      .then((response) => {
        should(response.acknowledge).be.true();
        should(response.partialErrors.length).be.exactly(1);
        should(response.partialErrors).be.an.Array().and.match([`The room ${collection2RoomName} does not match collection ${collection1}`]);
      });
  });

  it('should return a response with partial error if a roomId doesn\'t exist', () => {
    var
      badRoomName = 'badRoomId',
      requestObjectSubscribe = new Request({
        controller: 'subscribe',
        action: 'on',
        index: index,
        collection: collection1,
        body: {}
      }),
      requestObjectRemove = new Request({
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
