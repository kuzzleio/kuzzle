var
  should = require('should'),
  start = require('root-require')('lib/api/start');

describe('Test removeRoom function index.js file from DSL', function () {

  var
    kuzzle,
    roomId,
    roomName = 'roomNameGrace',
    collection = 'user',
    filter = {
      terms: {
        city: ['NYC', 'London']
      }
    };


  before(function (done) {
    kuzzle = {
      log: {
        debug: function() {},
        silly: function() {},
        error: function() {}
      },
      start: start
    };

    kuzzle.start({}, {workers: false, servers: false});

    kuzzle.hotelClerk.addSubscription({id: 'connectionid'}, roomName, collection, filter)
      .then(function (result) {

        roomId = result.data;

        console.log(kuzzle.dsl.filtersTree.user.city);
        done();
      });
  });

  it('should have an empty room list and filtersTree when the function is called', function () {
    console.log(kuzzle.hotelClerk.rooms[roomId]);
    return kuzzle.dsl.removeRoom(kuzzle.hotelClerk.rooms[roomId])
      .then(function () {
        console.log(kuzzle.dsl.filtersTree.user.city);
      });
  });


});