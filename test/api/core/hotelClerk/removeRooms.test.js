const
  should = require('should'),
  Request = require('kuzzle-common-objects').Request,
  Koncorde = require('koncorde'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  HotelClerk = require('../../../../lib/api/core/hotelClerk'),
  KuzzleMock = require('../../../mocks/kuzzle.mock');

describe('Test: hotelClerk.removeRooms', () => {
  let
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
    kuzzle.realtime = new Koncorde();
    context = {connectionId, token: {userId: ''}, user: {_id: ''}};

  });

  it('should remove room in global subscription for provided collection', () => {
    const
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
      .then(() => {
        const response = kuzzle.hotelClerk.removeRooms(removeRequest);
        should(response).have.property('acknowledged');
        should(response.acknowledged).be.true();

        should(kuzzle.hotelClerk.rooms).be.empty().Object();
        return null;
      });
  });

  it('should remove room for subscription with filter for provided collection', () => {
    const
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
        should(response).have.property('acknowledged');
        should(response.acknowledged).be.true();

        should(kuzzle.hotelClerk.rooms).be.empty().Object();
      });
  });

  it('should remove room for global and filter subscription provided collection', () => {
    const
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
      .then(() => {
        const response = kuzzle.hotelClerk.removeRooms(removeRequest);
        should(response).have.property('acknowledged');
        should(response.acknowledged).be.true();

        should(kuzzle.hotelClerk.rooms).be.empty().Object();

        return null;
      });
  });

  it('should remove only room for provided collection', () => {
    const
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
        should(response).have.property('acknowledged');
        should(response.acknowledged).be.true();

        should(kuzzle.hotelClerk.rooms).be.Object();
        should(Object.keys(kuzzle.hotelClerk.rooms).length).be.exactly(1);
      });
  });

  it('should throw if room is provided but is not an array', () => {
    const
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
        return should(() => kuzzle.hotelClerk.removeRooms(removeRequest))
          .throw(BadRequestError, { errorName: 'core.realtime.invalid_rooms' });
      });
  });

  it('should remove only listed rooms for the collection', () => {
    let roomId;
    const
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
    let index2RoomName;
    const
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

        const response = kuzzle.hotelClerk.removeRooms(removeRequest);

        should(response.acknowledged).be.true();
        should(response.partialErrors.length).be.exactly(1);
        should(response.partialErrors).be.an.Array().and.match([`The room ${index2RoomName} does not match index ${index}`]);
      });
  });

  it('should return a response with partial error if a roomId doesn\'t correspond to the collection', () => {
    let collection2RoomName;
    const
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

        const response = kuzzle.hotelClerk.removeRooms(removeRequest);
        should(response.acknowledged).be.true();
        should(response.partialErrors.length).be.exactly(1);
        should(response.partialErrors).be.an.Array().and.match([`The room ${collection2RoomName} does not match collection ${collection1}`]);
      });
  });

  it('should return a response with partial error if a roomId doesn\'t exist', () => {
    let badRoomName = 'badRoomId';
    const
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
      .then(() => {
        const response = kuzzle.hotelClerk.removeRooms(removeRequest);
        should(response.acknowledged).be.true();
        should(response.partialErrors.length).be.exactly(1);
        should(response.partialErrors).be.an.Array().and.match(['No room with id ' + badRoomName]);
      });
  });
});
