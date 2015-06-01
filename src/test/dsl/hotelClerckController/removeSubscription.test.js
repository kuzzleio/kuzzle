var
  should = require('should'),
  start = require('root-require')('lib/api/start');

require('should-promised');

describe('Test addSubscription function in hotelClerk controller', function () {

  var
    kuzzle,
    roomId,
    connection = {id: 'connectionid'},
    badConnection = {id: 'badconnectionid'},
    roomName1 = 'roomName1',
    roomName2 = 'roomName2',
    collection = 'user',
    filter = {
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
    kuzzle = {
      log: {
        debug: function() {},
        silly: function() {},
        error: function() {}
      },
      start: start
    };

    kuzzle.start({}, {workers: false, servers: false});
    return kuzzle.hotelClerk.addSubscription(connection, roomName1, collection, filter)
      .then(function (result) {
        roomId = result.data;
      });
  });

  it('should do nothing when a bad connectionId is given', function () {
    return should(kuzzle.hotelClerk.removeSubscription(badConnection, roomName1)).be.rejected;
  });

  it('should do nothing when a bad room is given', function () {
    return should(kuzzle.hotelClerk.removeSubscription(connection, 'badroomname')).be.rejected;
  });

  it('should clean up customers, rooms and filtersTree object', function () {
    return kuzzle.hotelClerk.removeSubscription(connection, roomName1)
      .then(function () {
        should(kuzzle.dsl.filtersTree).be.an.object;
        should(kuzzle.dsl.filtersTree).be.empty;

        should(kuzzle.dsl.rooms).be.an.object;
        should(kuzzle.dsl.rooms).be.empty;

        should(kuzzle.dsl.customers).be.an.object;
        should(kuzzle.dsl.customers).be.empty;
      });
  });


});