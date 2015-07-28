var
  should = require('should'),
  captainsLog = require('captains-log'),
  RequestObject = require('root-require')('lib/api/core/models/requestObject'),
  Kuzzle = require('root-require')('lib/api/Kuzzle');

require('should-promised');

describe('Test removeCustomerFromAllRooms function in the hotelClerk core module', function () {

  var
    kuzzle,
    roomId,
    connection = {id: 'connectionid'},
    badConnection = {id: 'badconnectionid'},
    roomName1 = 'roomName',
    roomName2 = 'roomName2',
    collection = 'user',
    filter1 = {
      term: {
        firstName: 'Ada'
      }
    },
    filter2 = {
      terms: {
        firstName: ['Ada', 'Grace']
      }
    };


  before(function () {
    kuzzle = new Kuzzle();
    kuzzle.log = new captainsLog({level: 'silent'});
    kuzzle.start({}, {workers: false, servers: false})
      .then(function() {
        var requestObject1 = new RequestObject({
            controller: 'subscribe',
            action: 'on',
            requestId: roomName1,
            collection: collection,
            body: filter1
          });

        return kuzzle.hotelClerk.addSubscription(requestObject1, connection);
      })
      .then(function () {
        var requestObject2 = new RequestObject({
          controller: 'subscribe',
          action: 'on',
          requestId: roomName2,
          collection: collection,
          body: filter2
        });

        return kuzzle.hotelClerk.addSubscription(requestObject2, connection);
      });
  });

  it('should do nothing when a bad connectionId is given', function () {
    return should(kuzzle.hotelClerk.removeCustomerFromAllRooms(badConnection.id)).be.rejected;
  });

  it('should clean up customers, rooms and filtersTree object', function () {
    return kuzzle.hotelClerk.removeCustomerFromAllRooms(connection.id)
      .then(function () {
        should(kuzzle.dsl.filtersTree).be.an.Object;
        should(kuzzle.dsl.filtersTree).be.empty;

        should(kuzzle.hotelClerk.rooms).be.an.Object;
        should(kuzzle.hotelClerk.rooms).be.empty;

        should(kuzzle.hotelClerk.customers).be.an.Object;
        should(kuzzle.hotelClerk.customers).be.empty;
      });
  });


});