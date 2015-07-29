var
  should = require('should'),
  captainsLog = require('captains-log'),
  RequestObject = require('root-require')('lib/api/core/models/requestObject'),
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
    },
    requestObject = new RequestObject({
      requestId: roomName,
      collection: collection,
      body: filter
    });


  before(function (callback) {
    kuzzle = new Kuzzle();
    kuzzle.log = new captainsLog({level: 'silent'});
    kuzzle.start({}, {workers: false, servers: false})
      .then(function () {
        return kuzzle.hotelClerk.addSubscription(requestObject, {id: 'connectionid'});
      })
      .then(function (realTimeResponseObject) {
        roomId = realTimeResponseObject.roomId;
        callback();
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