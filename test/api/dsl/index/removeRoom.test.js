var
  should = require('should'),
  captainsLog = require('captains-log'),
  Kuzzle = require('root-require')('lib/api/Kuzzle');

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


  before(function () {
    kuzzle = new Kuzzle();
    kuzzle.log = new captainsLog({level: 'silent'});
    kuzzle.start({}, {workers: false, servers: false});

    return kuzzle.hotelClerk.addSubscription({id: 'connectionid'}, roomName, collection, filter)
      .then(function (result) {
        roomId = result.data;
      });
  });

  it('should have an empty room list and filtersTree when the function is called', function () {
    should(kuzzle.dsl.filtersTree).be.Object;
    should(kuzzle.dsl.filtersTree).not.be.empty;

    return kuzzle.dsl.removeRoom(kuzzle.hotelClerk.rooms[roomId])
      .then(function () {
        should(kuzzle.dsl.filtersTree).be.empty.Object;
      });
  });


});