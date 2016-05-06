var
  should = require('should'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError'),
  NotFoundError = require.main.require('lib/api/core/errors/notFoundError');

describe('Test: hotelClerk.countSubscription', function () {
  var
    kuzzle;

  before(() => {
    kuzzle = new Kuzzle();
    return kuzzle.start(params, {dummy: true});
  });

  it('should reject the request if no room ID has been provided', function () {
    var requestObject = new RequestObject({
      body: {}
    });

    return should(kuzzle.hotelClerk.countSubscription(requestObject)).be.rejectedWith(BadRequestError, { message: 'The room Id is mandatory to count subscriptions' });
  });

  it('should reject the request if the provided room ID is unknown to Kuzzle', function () {
    var requestObject = new RequestObject({
      body: { roomId: 'foobar' }
    });

    return should(kuzzle.hotelClerk.countSubscription(requestObject)).be.rejectedWith(NotFoundError, { message: 'The room Id foobar does not exist' });
  });

  it('should return the right subscriptions count when handling a correct request', function () {
    var countRequest = new RequestObject({ body: { roomId: 'foobar'}});
    kuzzle.hotelClerk.rooms.foobar = {customers: ['foo', 'bar']};

    return kuzzle.hotelClerk.countSubscription(countRequest)
      .then(response => should(response.count).be.exactly(2));
  });
});
