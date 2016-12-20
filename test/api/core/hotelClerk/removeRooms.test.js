var
  should = require('should'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  Request = require('kuzzle-common-objects').Request,
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  Dsl = require('../../../../lib/api/dsl'),
  HotelClerk = require('../../../../lib/api/core/hotelClerk'),
  KuzzleMock = require('../../../mocks/kuzzle.mock');

describe('Test: hotelClerk.removeRooms', () => {
  var
    kuzzle,
    connectionId = 'connectionid',
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
    kuzzle = new KuzzleMock();
    kuzzle.hotelClerk = new HotelClerk(kuzzle);
    kuzzle.dsl = new Dsl();

    context = {
      connectionId,
      token: {
        userId: ''
      }
    };

  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should reject an error if there is no subscription on this index', () => {
    var request = new Request({
      controller: 'none',
      action: 'removeRooms',
      index: index,
      collection: collection1,
      body: {}
    }, context);

    return should(kuzzle.hotelClerk.removeRooms(request)).rejectedWith(NotFoundError);
  });

  it('should reject an error if there is no subscription on this collection', () => {
    var
      subscribeRequest = new Request({
        controller: 'realtime',
        action: 'subscribe',
        index: index,
        collection: collection1,
        body: {}
      }, context),
      removeRequest = new Request({
        controller: 'none',
        action: 'removeRooms',
        index: index,
        collection: collection2,
        body: {}
      }, context);

    return kuzzle.hotelClerk.addSubscription(subscribeRequest)
      .then(() => {
        return should(kuzzle.hotelClerk.removeRooms(removeRequest)).rejectedWith(NotFoundError);
      });
  });

  it('should remove room in global subscription for provided collection', () => {
    var
      subscribeRequest = new Request({
        controller: 'realtime',
        action: 'subscribe',
        index: index,
        collection: collection1,
        body: {}
      }, context),
      removeRequest = new Request({
        controller: 'none',
        action: 'removeRooms',
        index: index,
        collection: collection1,
        body: {}
      }, context);

    return kuzzle.hotelClerk.addSubscription(subscribeRequest)
      .then(() => kuzzle.hotelClerk.removeRooms(removeRequest))
      .then(response => {
        should(response).have.property('acknowledge');
        should(response.acknowledge).be.true();

        should(kuzzle.hotelClerk.rooms).be.empty().Object();
      });
  });

  it('should remove room for subscription with filter for provided collection', () => {
    var
      subscribeRequest = new Request({
        controller: 'realtime',
        action: 'subscribe',
        index: index,
        collection: collection1,
        body: filter1
      }, context),
      removeRequest = new Request({
        controller: 'none',
        action: 'removeRooms',
        index: index,
        collection: collection1,
        body: {}
      }, context);

    return kuzzle.hotelClerk.addSubscription(subscribeRequest)
      .then(() => kuzzle.hotelClerk.removeRooms(removeRequest))
      .then(response => {
        should(response).have.property('acknowledge');
        should(response.acknowledge).be.true();

        should(kuzzle.hotelClerk.rooms).be.empty().Object();
      });
  });

  it('should remove room for global and filter subscription provided collection', () => {
    var
      globalSubscribeRequest = new Request({
        controller: 'realtime',
        action: 'subscribe',
        index: index,
        collection: collection1,
        body: {}
      }, context),
      filterSubscribeRequest = new Request({
        controller: 'realtime',
        action: 'subscribe',
        index: index,
        collection: collection1,
        body: filter1
      }, context),
      removeRequest = new Request({
        controller: 'none',
        action: 'removeRooms',
        index: index,
        collection: collection1,
        body: {}
      }, context);

    return kuzzle.hotelClerk.addSubscription(globalSubscribeRequest)
      .then(() => kuzzle.hotelClerk.addSubscription(filterSubscribeRequest))
      .then(() => kuzzle.hotelClerk.removeRooms(removeRequest))
      .then(response => {
        should(response).have.property('acknowledge');
        should(response.acknowledge).be.true();

        should(kuzzle.hotelClerk.rooms).be.empty().Object();
      });
  });

  it('should remove only room for provided collection', () => {
    var
      subscribeCollection1 = new Request({
        controller: 'realtime',
        action: 'subscribe',
        index: index,
        collection: collection1,
        body: {}
      }, context),
      subscribeCollection2 = new Request({
        controller: 'realtime',
        action: 'subscribe',
        index: index,
        collection: collection2,
        body: {}
      }, context),
      removeRequest = new Request({
        controller: 'none',
        action: 'removeRooms',
        index: index,
        collection: collection1,
        body: {}
      }, context);

    return kuzzle.hotelClerk.addSubscription(subscribeCollection1)
      .then(() => kuzzle.hotelClerk.addSubscription(subscribeCollection2))
      .then(() => kuzzle.hotelClerk.removeRooms(removeRequest))
      .then(response => {
        should(response).have.property('acknowledge');
        should(response.acknowledge).be.true();

        should(kuzzle.hotelClerk.rooms).be.Object();
        should(Object.keys(kuzzle.hotelClerk.rooms).length).be.exactly(1);
      });
  });

  it('should reject an error if room is provided but is not an array', () => {
    var
      subscribeCollection1 = new Request({
        controller: 'realtime',
        action: 'subscribe',
        index: index,
        collection: collection1,
        body: {}
      }, context),
      removeRequest = new Request({
        controller: 'none',
        action: 'removeRooms',
        index: index,
        collection: collection1,
        body: {rooms: {}}
      }, context);

    return kuzzle.hotelClerk.addSubscription(subscribeCollection1)
      .then(() => {
        return should(kuzzle.hotelClerk.removeRooms(removeRequest)).be.rejectedWith(BadRequestError);
      });
  });

  it('should remove only listed rooms for the collection', () => {
    var
      roomId,
      subscribeFilter1 = new Request({
        controller: 'realtime',
        action: 'subscribe',
        index: index,
        collection: collection1,
        body: filter1
      }, context),
      subscribeFilter2 = new Request({
        controller: 'realtime',
        action: 'subscribe',
        index: index,
        collection: collection1,
        body: filter2
      }, context),
      removeRequest = new Request({
        controller: 'none',
        action: 'removeRooms',
        index: index,
        collection: collection1,
        body: {rooms: []}
      }, context);

    return kuzzle.hotelClerk.addSubscription(subscribeFilter1)
      .then(result => {
        roomId = result.roomId;
        removeRequest.input.body.rooms.push(roomId);
        return kuzzle.hotelClerk.addSubscription(subscribeFilter2);
      })
      .then(() => kuzzle.hotelClerk.removeRooms(removeRequest))
      .then(() => {
        should(Object.keys(kuzzle.hotelClerk.rooms).length).be.exactly(1);
        should(kuzzle.hotelClerk.rooms[roomId]).be.undefined();
      });
  });

  it('should return a response with partial error if a roomId doesn\'t correspond to the index', () => {
    var
      index2RoomName,
      subscribe1 = new Request({
        controller: 'realtime',
        action: 'subscribe',
        index: index,
        collection: collection1,
        body: {}
      }, context),
      subscribe2 = new Request({
        controller: 'realtime',
        action: 'subscribe',
        index: 'index2',
        collection: collection1,
        body: {}
      }, context),
      removeRequest = new Request({
        controller: 'none',
        action: 'removeRooms',
        index: index,
        collection: collection1,
        body: {rooms: []}
      }, context);

    return kuzzle.hotelClerk.addSubscription(subscribe1)
      .then(() => kuzzle.hotelClerk.addSubscription(subscribe2))
      .then(result => {
        index2RoomName = result.roomId;
        removeRequest.input.body.rooms.push(index2RoomName);
        return kuzzle.hotelClerk.removeRooms(removeRequest);
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
      subscribe1 = new Request({
        controller: 'realtime',
        action: 'subscribe',
        index: index,
        collection: collection1,
        body: {}
      }, context),
      subscribe2 = new Request({
        controller: 'realtime',
        action: 'subscribe',
        index: index,
        collection: collection2,
        body: {}
      }, context),
      removeRequest = new Request({
        controller: 'none',
        action: 'removeRooms',
        index: index,
        collection: collection1,
        body: {rooms: []}
      });

    return kuzzle.hotelClerk.addSubscription(subscribe1, context)
      .then(() => kuzzle.hotelClerk.addSubscription(subscribe2, context))
      .then(result => {
        collection2RoomName = result.roomId;
        removeRequest.input.body.rooms.push(collection2RoomName);
        return kuzzle.hotelClerk.removeRooms(removeRequest);
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
      subscribeRequest = new Request({
        controller: 'realtime',
        action: 'subscribe',
        index: index,
        collection: collection1,
        body: {}
      }, context),
      removeRequest = new Request({
        controller: 'none',
        action: 'removeRooms',
        index: index,
        collection: collection1,
        body: {rooms: [badRoomName]}
      }, context);

    return kuzzle.hotelClerk.addSubscription(subscribeRequest, context)
      .then(() => kuzzle.hotelClerk.removeRooms(removeRequest))
      .then(response => {
        should(response.acknowledge).be.true();
        should(response.partialErrors.length).be.exactly(1);
        should(response.partialErrors).be.an.Array().and.match(['No room with id ' + badRoomName]);
      });
  });
});
