var
  should = require('should'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  params = require('rc')('kuzzle'),
  KuzzleServer = require.main.require('lib/api/kuzzleServer'),
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError,
  NotFoundError = require.main.require('kuzzle-common-objects').Errors.notFoundError;

describe('Test: hotelClerk.countSubscription', () => {
  var
    kuzzle;

  before(() => {
    kuzzle = new KuzzleServer();
  });

  it('should reject the request if no room ID has been provided', () => {
    var requestObject = new RequestObject({
      body: {}
    });

    return should(kuzzle.hotelClerk.countSubscription(requestObject)).be.rejectedWith(BadRequestError, { message: 'The room Id is mandatory to count subscriptions' });
  });

  it('should reject the request if the provided room ID is unknown to Kuzzle', () => {
    var requestObject = new RequestObject({
      body: { roomId: 'foobar' }
    });

    return should(kuzzle.hotelClerk.countSubscription(requestObject)).be.rejectedWith(NotFoundError, { message: 'The room Id foobar does not exist' });
  });

  it('should return the right subscriptions count when handling a correct request', () => {
    var countRequest = new RequestObject({ body: { roomId: 'foobar'}});
    kuzzle.hotelClerk.rooms.foobar = {customers: ['foo', 'bar']};

    return kuzzle.hotelClerk.countSubscription(countRequest)
      .then(response => should(response.count).be.exactly(2));
  });
});
