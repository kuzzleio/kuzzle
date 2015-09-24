var
  should = require('should'),
  captainsLog = require('captains-log'),
  RequestObject = require('root-require')('lib/api/core/models/requestObject'),
  params = require('rc')('kuzzle'),
  Kuzzle = require('../../../../lib/api/Kuzzle');


require('should-promised');

describe('Test: hotelClerk.addSubscription', function () {
  var
    kuzzle,
    roomId,
    connection = {id: 'connectionid'},
    roomName = 'roomName',
    collection = 'user',
    filter = {
      term: {
        firstName: 'Ada'
      }
    };

  beforeEach(function () {
    require.cache = {};
    kuzzle = new Kuzzle();
    kuzzle.log = new captainsLog({level: 'silent'});

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
      requestId: roomName,
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
        should(kuzzle.hotelClerk.customers[connection.id][roomName]).be.exactly(roomId);
      });
  });

  it('should call a function join when the type is websocket', function () {
    var
      joinedRooms = [],
      requestObject = new RequestObject({
        requestId: roomName,
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
        should(joinedRooms).containEql('b6fba02d3a45c4d6a9bb224532e12eb1');
        delete connection.type;
      });
  });

  it('should return an error when the user has already subscribed to the filter', function () {
    var requestObject = new RequestObject({
      requestId: roomName,
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
        requestId: roomName,
        collection: collection,
        body: {badterm : {firstName: 'Ada'}}
      });

    pAddSubscription = kuzzle.hotelClerk.addSubscription(requestObject, connection);
    return should(pAddSubscription).be.rejected();
  });

  it('should handle non-string requestIds', function () {
    var requestObject = new RequestObject({
      requestId: 0xCAFED00D,
      collection: collection,
      body: filter
    });

    return should(kuzzle.hotelClerk.addSubscription(requestObject, connection)).be.fulfilled();
  });
});
