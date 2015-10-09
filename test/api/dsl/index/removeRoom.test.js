var
  should = require('should'),
  winston = require('winston'),
  rewire = require('rewire'),
  RequestObject = require('root-require')('lib/api/core/models/requestObject'),
  params = require('rc')('kuzzle'),
  Kuzzle = require('root-require')('lib/api/Kuzzle'),
  Dsl = rewire('../../../../lib/api/dsl/index');

require('should-promised');

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


  beforeEach(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.log = new (winston.Logger)({transports: [new (winston.transports.Console)({level: 'silent'})]});
    kuzzle.removeAllListeners();
    kuzzle.start(params, {dummy: true})
      .then(function () {
        return kuzzle.hotelClerk.addSubscription(requestObject, {id: 'connectionid'});
      })
      .then(function (realTimeResponseObject) {
        roomId = realTimeResponseObject.roomId;
        done();
      });
  });

  it('should return a promise', function () {
    var result = kuzzle.dsl.removeRoom(kuzzle.hotelClerk.rooms[roomId]);

    should(result).be.a.Promise();
    return should(result).be.fulfilled();
  });

  it('should have an empty room list and filtersTree when the function is called', function () {
    should(kuzzle.dsl.filtersTree).be.Object();
    should(kuzzle.dsl.filtersTree).not.be.empty();

    return kuzzle.dsl.removeRoom(kuzzle.hotelClerk.rooms[roomId])
      .then(function () {
        should(kuzzle.dsl.filtersTree).be.empty().Object();
      });
  });

  it('should return a reject promise on fail', function () {
    Dsl.__with__({
      removeRoomFromFields: function () { return Promise.reject(new Error('rejected')); }
    })(function () {
      var dsl = new Dsl(kuzzle);
      return should(dsl.removeRoom(kuzzle.hotelClerk.rooms[roomId])).be.rejected();
    });
  });
});