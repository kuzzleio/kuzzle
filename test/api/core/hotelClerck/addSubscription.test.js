var
  should = require('should'),
  winston = require('winston'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  params = require('rc')('kuzzle'),
  Kuzzle = require('../../../../lib/api/Kuzzle'),
  ForbiddenError = require.main.require('lib/api/core/errors/forbiddenError');

require('should-promised');

describe('Test: hotelClerk.addSubscription', function () {
  var
    kuzzle,
    roomId,
    connection = {id: 'connectionid'},
    collection = 'user',
    filter = {
      term: {
        firstName: 'Ada'
      }
    };

  beforeEach(function () {
    require.cache = {};
    kuzzle = new Kuzzle();
    kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});
    kuzzle.removeAllListeners();

    return kuzzle.start(params, {dummy: true});
  });

  it('should have object filtersTree, customers and rooms empty', function () {
    should(kuzzle.dsl.filtersTree).be.an.Object();
    should(kuzzle.dsl.filtersTree).be.empty();

    should(kuzzle.hotelClerk.rooms).be.an.Object();
    should(kuzzle.hotelClerk.rooms).be.empty();

    should(kuzzle.hotelClerk.customers).be.an.Object();
    should(kuzzle.hotelClerk.customers).be.empty();
  });

  it('should have the new room and customer', function () {
    var requestObject = new RequestObject({
      controller: 'subscribe',
      action: 'on',
      collection: collection,
      body: filter
    });

    return kuzzle.hotelClerk.addSubscription(requestObject, connection)
      .then(function (realTimeResponseObject) {
        should(kuzzle.dsl.filtersTree).be.an.Object();
        should(kuzzle.dsl.filtersTree).not.be.empty();

        should(kuzzle.hotelClerk.rooms).be.an.Object();
        should(kuzzle.hotelClerk.rooms).not.be.empty();

        should(kuzzle.hotelClerk.customers).be.an.Object();
        should(kuzzle.hotelClerk.customers).not.be.empty();

        should(realTimeResponseObject).be.an.Object();
        should(realTimeResponseObject.roomId).be.a.String();
        should(kuzzle.hotelClerk.rooms[realTimeResponseObject.roomId]).be.an.Object();
        should(kuzzle.hotelClerk.rooms[realTimeResponseObject.roomId]).not.be.empty();

        roomId = kuzzle.hotelClerk.rooms[realTimeResponseObject.roomId].id;

        should(kuzzle.hotelClerk.customers[connection.id]).be.an.Object();
        should(kuzzle.hotelClerk.customers[connection.id]).not.be.empty();
        should(kuzzle.hotelClerk.customers[connection.id]).match([roomId]);
      });
  });

  it('should call a function join when the type is websocket', function () {
    var
      joinedRooms = [],
      requestObject = new RequestObject({
        controller: 'subscribe',
        collection: collection,
        body: filter
      });

    // mockup internal function kuzzle called when type is websocket
    connection.type = 'websocket';
    kuzzle.io = {
      sockets: {
        connected: {
          connectionid: {
            join: function (roomId) {
              joinedRooms.push(roomId);
            }
          }
        }
      }
    };
    kuzzle.notifier = {notify: function () {}};

    return kuzzle.hotelClerk.addSubscription(requestObject, connection)
      .then(function () {
        should(joinedRooms).containEql(roomId);
        delete connection.type;
      });
  });

  it('should return an error when the user has already subscribed to the filter', function () {
    var requestObject = new RequestObject({
      controller: 'subscribe',
      collection: collection,
      body: filter
    });

    return kuzzle.hotelClerk.addSubscription(requestObject, connection)
      .then(function () {
        return should(kuzzle.hotelClerk.addSubscription(requestObject, connection)).be.rejected();
      });
  });

  it('should reject an error when a filter is unknown', function () {
    var
      pAddSubscription,
      requestObject = new RequestObject({
        controller: 'subscribe',
        action: 'on',
        collection: collection,
        body: {badterm : {firstName: 'Ada'}}
      });

    pAddSubscription = kuzzle.hotelClerk.addSubscription(requestObject, connection);
    return should(pAddSubscription).be.rejected();
  });

  it('should return the same room ID if the same filters are used', function () {
    var
      requestObject1 = new RequestObject({
        controller: 'subscribe',
        collection: collection,
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
        body: {
          exists: {
            field: 'lastName'
          },
          term: {
            firstName: 'Ada'
          }
        }
      });

    return kuzzle.hotelClerk.addSubscription(requestObject1, connection)
      .then(() => {
        return should(kuzzle.hotelClerk.addSubscription(requestObject2, connection)).be.rejectedWith(ForbiddenError);
      });
  });

  it('should allow subscribing with an empty filter', function () {
    var
      requestObject = new RequestObject({
        controller: 'subscribe',
        collection: collection,
        //body: {}
      });

    delete requestObject.data.body;
    return should(kuzzle.hotelClerk.addSubscription(requestObject, connection)).be.fulfilled();
  });
});
