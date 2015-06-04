var
  should = require('should'),
  start = require('root-require')('lib/api/start');

require('should-promised');

describe('Test removeSubscription function in hotelClerk controller', function () {

  var
    kuzzle,
    roomId,
    connection = {id: 'connectionid'},
    badConnection = {id: 'badconnectionid'},
    roomName1 = 'roomName1',
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


  beforeEach(function () {
    kuzzle = {
      log: {
        debug: function() {},
        silly: function() {},
        error: function() {}
      },
      start: start
    };

    kuzzle.start({}, {workers: false, servers: false});
    return kuzzle.hotelClerk.addSubscription(connection, roomName1, collection, filter1)
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
        should(kuzzle.dsl.filtersTree).be.an.Object;
        should(kuzzle.dsl.filtersTree).be.empty;

        should(kuzzle.hotelClerk.rooms).be.an.Object;
        should(kuzzle.hotelClerk.rooms).be.empty;

        should(kuzzle.hotelClerk.customers).be.an.Object;
        should(kuzzle.hotelClerk.customers).be.empty;
      });
  });

  it('should not delete all subscriptions when we want to just remove one', function () {
    return kuzzle.hotelClerk.addSubscription(connection, roomName2, collection, filter2)
      .then(function () {
        return kuzzle.hotelClerk.removeSubscription(connection, roomName1)
          .then(function () {
            should(kuzzle.dsl.filtersTree).be.an.Object;
            should(kuzzle.dsl.filtersTree).not.be.empty;

            should(kuzzle.hotelClerk.rooms).be.an.Object;
            should(kuzzle.hotelClerk.rooms).not.be.empty;

            should(kuzzle.hotelClerk.customers).be.an.Object;
            should(kuzzle.hotelClerk.customers).not.be.empty;
          });
      });
  });


});