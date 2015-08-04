var
  should = require('should'),
  captainsLog = require('captains-log'),
  RequestObject = require('root-require')('lib/api/core/models/requestObject'),
  Kuzzle = require('root-require')('lib/api/Kuzzle');

require('should-promised');

describe('Test addSubscription function in the hotelClerk core module', function () {

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


  beforeEach(function (callback) {
    kuzzle = new Kuzzle();
    kuzzle.log = new captainsLog({level: 'silent'});
    kuzzle.start({}, {dummy: true}).then(function () {
      callback();
    });
  });

  it('should have object filtersTree, customers and rooms empty', function () {
    should(kuzzle.dsl.filtersTree).be.an.Object;
    should(kuzzle.dsl.filtersTree).be.empty;

    should(kuzzle.hotelClerk.rooms).be.an.Object;
    should(kuzzle.hotelClerk.rooms).be.empty;

    should(kuzzle.hotelClerk.customers).be.an.Object;
    should(kuzzle.hotelClerk.customers).be.empty;
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
        should(kuzzle.dsl.filtersTree).be.an.Object;
        should(kuzzle.dsl.filtersTree).not.be.empty;

        should(kuzzle.hotelClerk.rooms).be.an.Object;
        should(kuzzle.hotelClerk.rooms).not.be.empty;

        should(kuzzle.hotelClerk.customers).be.an.Object;
        should(kuzzle.hotelClerk.customers).not.be.empty;

        should(realTimeResponseObject).be.an.Object;
        should(realTimeResponseObject.roomId).be.a.String;
        should(kuzzle.hotelClerk.rooms[realTimeResponseObject.roomId]).be.an.Object;
        should(kuzzle.hotelClerk.rooms[realTimeResponseObject.roomId]).not.be.empty;

        roomId = kuzzle.hotelClerk.rooms[realTimeResponseObject.roomId].id;

        should(kuzzle.hotelClerk.customers[connection.id]).be.an.Object;
        should(kuzzle.hotelClerk.customers[connection.id]).not.be.empty;
        should(kuzzle.hotelClerk.customers[connection.id][roomName]).be.exactly(roomId);
      });
  });

  it('should return an error when the user has already subscribe to the filter', function () {
    var requestObject = new RequestObject({
      requestId: roomName,
      collection: collection,
      body: filter
    });

    return kuzzle.hotelClerk.addSubscription(requestObject, connection)
      .then(function () {
        return should(kuzzle.hotelClerk.addSubscription(requestObject, connection)).be.rejected;
      });
  });


});