var
  should = require('should'),
  captainsLog = require('captains-log'),
  RequestObject = require('root-require')('lib/api/core/models/requestObject'),
  params = require('rc')('kuzzle'),
  Kuzzle = require('root-require')('lib/api/Kuzzle');

require('should-promised');

describe('Test: hotelClerk.countSubscription', function () {
  var
    kuzzle;

  before(function () {
    kuzzle = new Kuzzle();
    kuzzle.log = new captainsLog({level: 'silent'});
    return kuzzle.start(params, {dummy: true});
  });

  it('should reject the request if no room ID has been provided', function () {
    var requestObject = new RequestObject({
      body: {}
    });

    return should(kuzzle.hotelClerk.countSubscription(requestObject)).be.rejectedWith('The room Id is mandatory for count subscription');
  });

  it('should reject the request if the provided room ID is unknown to Kuzzle', function () {
    var requestObject = new RequestObject({
      body: { roomId: 'foobar' }
    });

    return should(kuzzle.hotelClerk.countSubscription(requestObject)).be.rejectedWith('The room Id foobar is unknown');
  });

  it('should return the right subscriptions count when handling a correct request', function () {
    var
      subscribeRequest = new RequestObject({
          controller: 'subscribe',
          action: 'on',
          requestId: 'foo',
          collection: 'bar',
          body: { term: { foo: 'bar' } }
        }),
      countRequest = new RequestObject({ body: {}});

    return kuzzle.hotelClerk.addSubscription(subscribeRequest, { id: 'a connection'})
      .then(function (createdRoom) {
        countRequest.data.body.roomId = createdRoom.roomId;
        return kuzzle.hotelClerk.addSubscription(subscribeRequest, { id: 'another connection'});
      })
      .then(function () {
        return kuzzle.hotelClerk.countSubscription(countRequest);
      })
      .then(function (response) {
        should(response.roomId).be.exactly(countRequest.data.body.roomId);
        should(response.count).be.exactly(2);
        return kuzzle.hotelClerk.removeSubscription(subscribeRequest, { id: 'a connection'});
      })
      .then(function () {
        return kuzzle.hotelClerk.countSubscription(countRequest);
      })
      .then(function (response) {
        should(response.roomId).be.exactly(countRequest.data.body.roomId);
        should(response.count).be.exactly(1);
      });
  });
});
