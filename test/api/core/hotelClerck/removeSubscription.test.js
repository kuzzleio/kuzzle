var
  should = require('should'),
  captainsLog = require('captains-log'),
  RequestObject = require('root-require')('lib/api/core/models/requestObject'),
  params = require('rc')('kuzzle'),
  Kuzzle = require('root-require')('lib/api/Kuzzle');

require('should-promised');

describe('Test removeSubscription function in the hotelClerk core module', function () {

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
    },
    requestObject1 = new RequestObject({
      controller: 'subscribe',
      action: 'on',
      requestId: roomName1,
      collection: collection,
      body: filter1
    }),
    requestObject2 = new RequestObject({
      controller: 'subscribe',
      action: 'on',
      requestId: roomName2,
      collection: collection,
      body: filter2
    });


  beforeEach(function (callback) {
    kuzzle = new Kuzzle();
    kuzzle.log = new captainsLog({level: 'silent'});
    kuzzle.start(params, {dummy: true})
      .then(function () {
        return kuzzle.hotelClerk.addSubscription(requestObject1, connection);
      })
      .then(function (realTimeResponseObject) {
        roomId = realTimeResponseObject.roomId;
        callback();
      });
  });

  it('should do nothing when a bad connectionId is given', function () {
    return should(kuzzle.hotelClerk.removeSubscription(requestObject1, badConnection)).be.rejected;
  });

  it('should do nothing when a bad room is given', function () {
    var badRequestObject = new RequestObject({
      controller: 'subscribe',
      action: 'on',
      requestId: 'badroomname',
      collection: collection,
      body: filter1
    });

    return should(kuzzle.hotelClerk.removeSubscription(badRequestObject, connection)).be.rejected;
  });

  it('should clean up customers, rooms and filtersTree object', function () {
    return kuzzle.hotelClerk.removeSubscription(requestObject1, connection)
      .then(function () {
        should(kuzzle.dsl.filtersTree).be.an.Object();
        should(kuzzle.dsl.filtersTree).be.empty();

        should(kuzzle.hotelClerk.rooms).be.an.Object();
        should(kuzzle.hotelClerk.rooms).be.empty();

        should(kuzzle.hotelClerk.customers).be.an.Object();
        should(kuzzle.hotelClerk.customers).be.empty();
      });
  });

  it('should not delete all subscriptions when we want to just remove one', function () {
    return kuzzle.hotelClerk.addSubscription(requestObject2, connection)
      .then(function () {
        return kuzzle.hotelClerk.removeSubscription(requestObject1, connection)
          .then(function () {
            should(kuzzle.dsl.filtersTree).be.an.Object();
            should(kuzzle.dsl.filtersTree).not.be.empty();

            should(kuzzle.hotelClerk.rooms).be.an.Object();
            should(kuzzle.hotelClerk.rooms).not.be.empty();

            should(kuzzle.hotelClerk.customers).be.an.Object();
            should(kuzzle.hotelClerk.customers).not.be.empty();
          });
      });
  });


});