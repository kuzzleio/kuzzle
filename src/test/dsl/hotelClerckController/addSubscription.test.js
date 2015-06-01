var
  should = require('should'),
  start = require('root-require')('lib/api/start');

describe('Test addSubscription function in hotelClerk controller', function () {

  var
    kuzzle,
    roomId,
    connection = {id: 'connectionid'},
    roomName = 'roomNameGrace',
    collection = 'user',
    filterGrace = {
      term: {
        firstName: 'Ada'
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
  });

  it('should has object filtersTree, customers and rooms empty', function () {
    should(kuzzle.dsl.filtersTree).be.an.object;
    should(kuzzle.dsl.filtersTree).be.empty;

    should(kuzzle.dsl.rooms).be.an.object;
    should(kuzzle.dsl.rooms).be.empty;

    should(kuzzle.dsl.customers).be.an.object;
    should(kuzzle.dsl.customers).be.empty;
  });

  it('should has the new room and customer', function () {
    return kuzzle.hotelClerk.addSubscription(connection, roomName, collection, filterGrace)
      .then(function (result) {
        should(kuzzle.dsl.filtersTree).be.an.object;
        should(kuzzle.dsl.filtersTree).not.be.empty;

        should(kuzzle.hotelClerk.rooms).be.an.object;
        should(kuzzle.hotelClerk.rooms).not.be.empty;

        should(kuzzle.hotelClerk.customers).be.an.object;
        should(kuzzle.hotelClerk.customers).not.be.empty;

        should(result).be.an.object;
        should(result.data).be.a.String;
        should(result).not.be.an.object;
        should(kuzzle.hotelClerk.rooms[result.data]).not.be.an.object;
      });
  });

  it('should return an error when the user has already subscribe to the filter', function () {

  });


});