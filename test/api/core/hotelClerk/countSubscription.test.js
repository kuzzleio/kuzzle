var
  should = require('should'),
  Request = require('kuzzle-common-objects').Request,
  Kuzzle = require('../../../../lib/api/kuzzle'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError;

describe('Test: hotelClerk.countSubscription', () => {
  var
    kuzzle;

  before(() => {
    kuzzle = new Kuzzle();
  });

  it('should reject the request if no room ID has been provided', () => {
    var requestObject = new Request({
      body: {}
    });

    return should(kuzzle.hotelClerk.countSubscription(requestObject)).be.rejectedWith(BadRequestError, { message: 'The room Id is mandatory to count subscriptions' });
  });

  it('should reject the request if the provided room ID is unknown to Kuzzle', () => {
    var requestObject = new Request({
      body: { roomId: 'foobar' }
    });

    return should(kuzzle.hotelClerk.countSubscription(requestObject)).be.rejectedWith(NotFoundError, { message: 'The room Id foobar does not exist' });
  });

  it('should return the right subscriptions count when handling a correct request', () => {
    var countRequest = new Request({ body: { roomId: 'foobar'}});
    kuzzle.hotelClerk.rooms.foobar = {customers: ['foo', 'bar']};

    return kuzzle.hotelClerk.countSubscription(countRequest)
      .then(response => should(response.count).be.exactly(2));
  });
});
