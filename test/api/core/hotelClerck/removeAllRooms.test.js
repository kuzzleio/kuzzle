var
  should = require('should'),
  winston = require('winston'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError'),
  NotFoundError = require.main.require('lib/api/core/errors/notFoundError'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  Role = require.main.require('lib/api/core/models/security/role');

require('should-promised');

describe('Test: hotelClerk.removeRooms', function () {
  var
    kuzzle,
    connection = {id: 'connectionid'},
    context = {
      connection: connection,
      user: null
    },
    roomName = 'roomName',
    collection1 = 'user',
    collection2 = 'foo',
    filter1 = {
      term: {
        firstName: 'Ada'
      }
    },
    filter2 = {
      term: {
        name: 'foo'
      }
    };

  beforeEach(function (done) {
    require.cache = {};
    kuzzle = new Kuzzle();
    kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});
    kuzzle.removeAllListeners();

    return kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.repositories.role.roles.guest = new Role();
        return kuzzle.repositories.role.hydrate(kuzzle.repositories.role.roles.guest, params.userRoles.guest);
      })
      .then(function () {
        kuzzle.repositories.profile.profiles.anonymous = new Profile();
        return kuzzle.repositories.profile.hydrate(kuzzle.repositories.profile.profiles.anonymous, params.userProfiles.anonymous);
      })
      .then(function () {
        return kuzzle.repositories.user.anonymous();
      })
      .then(function (user) {
        context.user = user;
        done();
      });
  });

  it('should reject an error if no collection provided', function () {
    var requestObject = new RequestObject({
      controller: 'admin',
      action: 'removeRooms',
      requestId: roomName,
      collection: undefined,
      body: {}
    });

    return should(kuzzle.hotelClerk.removeRooms(requestObject)).rejectedWith(BadRequestError);
  });

  it('should reject an error if there is no subscription on this collection', function () {
    var requestObject = new RequestObject({
      controller: 'admin',
      action: 'removeRooms',
      requestId: roomName,
      collection: collection1,
      body: {}
    });

    return should(kuzzle.hotelClerk.removeRooms(requestObject)).rejectedWith(NotFoundError);
  });

  it('should remove room in global subscription for provided collection', function () {
    var
      requestObjectSubscribe = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        requestId: roomName,
        collection: collection1,
        body: {}
      }),
      requestObjectRemove = new RequestObject({
        controller: 'admin',
        action: 'removeRooms',
        requestId: roomName,
        collection: collection1,
        body: {}
      });

    return kuzzle.hotelClerk.addSubscription(requestObjectSubscribe, context)
      .then(() => {
        return kuzzle.hotelClerk.removeRooms(requestObjectRemove);
      })
      .then(responseObject => {
        should(responseObject.data.body).have.property('acknowledge');
        should(responseObject.data.body.acknowledge).be.true();

        should(kuzzle.hotelClerk.rooms).be.empty().Object();
        should(kuzzle.dsl.filtersTree).be.empty().Object();
      });
  });

  it('should remove room for subscription with filter for provided collection', function () {
    var
      requestObjectSubscribe = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        requestId: roomName,
        collection: collection1,
        body: filter1
      }),
      requestObjectRemove = new RequestObject({
        controller: 'admin',
        action: 'removeRooms',
        requestId: roomName,
        collection: collection1,
        body: {}
      });

    return kuzzle.hotelClerk.addSubscription(requestObjectSubscribe, context)
      .then(() => {
        return kuzzle.hotelClerk.removeRooms(requestObjectRemove);
      })
      .then(responseObject => {
        should(responseObject.data.body).have.property('acknowledge');
        should(responseObject.data.body.acknowledge).be.true();

        should(kuzzle.hotelClerk.rooms).be.empty().Object();
        should(kuzzle.dsl.filtersTree).be.empty().Object();
      });
  });

  it('should remove room for global and filter subscription provided collection', function () {
    var
      requestObjectSubscribeGlobal = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        requestId: roomName,
        collection: collection1,
        body: {}
      }),
      requestObjectSubscribeFilter = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        requestId: roomName,
        collection: collection1,
        body: filter1
      }),
      requestObjectRemove = new RequestObject({
        controller: 'admin',
        action: 'removeRooms',
        requestId: roomName,
        collection: collection1,
        body: {}
      });

    return kuzzle.hotelClerk.addSubscription(requestObjectSubscribeGlobal, context)
      .then(() => {
        return kuzzle.hotelClerk.addSubscription(requestObjectSubscribeFilter, context);
      })
      .then(() => {
        return kuzzle.hotelClerk.removeRooms(requestObjectRemove);
      })
      .then(responseObject => {
        should(responseObject.data.body).have.property('acknowledge');
        should(responseObject.data.body.acknowledge).be.true();

        should(kuzzle.hotelClerk.rooms).be.empty().Object();
        should(kuzzle.dsl.filtersTree).be.empty().Object();
      });
  });

  it('should remove only room for provided collection', function () {
    var
      requestObjectSubscribeCollection1 = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        requestId: roomName,
        collection: collection1,
        body: {}
      }),
      requestObjectSubscribeCollection2 = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        requestId: roomName,
        collection: collection2,
        body: {}
      }),
      requestObjectRemove = new RequestObject({
        controller: 'admin',
        action: 'removeRooms',
        requestId: roomName,
        collection: collection1,
        body: {}
      });

    return kuzzle.hotelClerk.addSubscription(requestObjectSubscribeCollection1, context)
      .then(() => {
        return kuzzle.hotelClerk.addSubscription(requestObjectSubscribeCollection2, context);
      })
      .then(() => {
        return kuzzle.hotelClerk.removeRooms(requestObjectRemove);
      })
      .then(responseObject => {
        should(responseObject.data.body).have.property('acknowledge');
        should(responseObject.data.body.acknowledge).be.true();

        should(kuzzle.hotelClerk.rooms).be.Object();
        should(Object.keys(kuzzle.hotelClerk.rooms).length).be.exactly(1);

        should(kuzzle.dsl.filtersTree).be.Object();
        should(Object.keys(kuzzle.dsl.filtersTree).length).be.exactly(1);
        should(kuzzle.dsl.filtersTree[collection1]).be.undefined();
        should(kuzzle.dsl.filtersTree[collection2]).be.Object();
      });
  });

  it('should reject an error if room is provided but is not an array', function () {
    var
      requestObjectSubscribeCollection1 = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        requestId: roomName,
        collection: collection1,
        body: {}
      }),
      requestObjectRemove = new RequestObject({
        controller: 'admin',
        action: 'removeRooms',
        requestId: roomName,
        collection: collection1,
        body: {rooms: {}}
      });

    return kuzzle.hotelClerk.addSubscription(requestObjectSubscribeCollection1, context)
      .then(() => {
        return should(kuzzle.hotelClerk.removeRooms(requestObjectRemove)).be.rejectedWith(BadRequestError);
      });
  });

  it('should remove only listed rooms for the collection', function () {
    var
      roomName = '3e0e837b447bf16b2251025ad36f39ed',
      requestObjectSubscribeFilter1 = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        requestId: roomName,
        collection: collection1,
        body: filter1
      }),
      requestObjectSubscribeFilter2 = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        requestId: roomName,
        collection: collection1,
        body: filter2
      }),
      requestObjectRemove = new RequestObject({
        controller: 'admin',
        action: 'removeRooms',
        requestId: roomName,
        collection: collection1,
        body: {rooms: [roomName]}
      });

    return kuzzle.hotelClerk.addSubscription(requestObjectSubscribeFilter1, context)
      .then(() => {
        return kuzzle.hotelClerk.addSubscription(requestObjectSubscribeFilter2, context);
      })
      .then(() => {
        return kuzzle.hotelClerk.removeRooms(requestObjectRemove);
      })
      .then(() => {
        should(Object.keys(kuzzle.hotelClerk.rooms).length).be.exactly(1);
        should(kuzzle.hotelClerk.rooms[roomName]).be.undefined();
      });
  });

  it('should return a response with partial error if a roomId doesn\'t correspond to the collection', function () {
    var
      badRoomName = 'c5fbe423c70b2924d9eebbc285a1b983',
      requestObjectSubscribe1 = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        requestId: roomName,
        collection: collection1,
        body: {}
      }),
      requestObjectSubscribe2 = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        requestId: roomName,
        collection: collection2,
        body: {}
      }),
      requestObjectRemove = new RequestObject({
        controller: 'admin',
        action: 'removeRooms',
        requestId: roomName,
        collection: collection1,
        body: {rooms: [badRoomName]}
      });

    return kuzzle.hotelClerk.addSubscription(requestObjectSubscribe1, context)
      .then(() => {
        return kuzzle.hotelClerk.addSubscription(requestObjectSubscribe2, context);
      })
      .then(() => {
        return kuzzle.hotelClerk.removeRooms(requestObjectRemove);
      })
      .then((responseObject) => {
        should(responseObject.status).be.exactly(206);
        should(responseObject.error).be.not.null();
        should(responseObject.error.count).be.exactly(1);
        should(responseObject.error.message).be.exactly('Some errors with provided rooms');
        should(responseObject.error.errors).be.an.Array().and.match(['The room with id ' + badRoomName + ' doesn\'t correspond to collection ' + collection1]);
      });
  });

  it('should return a response with partial error if a roomId doesn\'t exist', function () {
    var
      badRoomName = 'badRoomId',
      requestObjectSubscribe = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        requestId: roomName,
        collection: collection1,
        body: {}
      }),
      requestObjectRemove = new RequestObject({
        controller: 'admin',
        action: 'removeRooms',
        requestId: roomName,
        collection: collection1,
        body: {rooms: [badRoomName]}
      });

    return kuzzle.hotelClerk.addSubscription(requestObjectSubscribe, context)
      .then(() => {
        return kuzzle.hotelClerk.removeRooms(requestObjectRemove);
      })
      .then((responseObject) => {
        should(responseObject.status).be.exactly(206);
        should(responseObject.error).be.not.null();
        should(responseObject.error.count).be.exactly(1);
        should(responseObject.error.message).be.exactly('Some errors with provided rooms');
        should(responseObject.error.errors).be.an.Array().and.match(['No room with id ' + badRoomName]);
      });
  });
});
