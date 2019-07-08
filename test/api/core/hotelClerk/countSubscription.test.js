const
  should = require('should'),
  Request = require('kuzzle-common-objects').Request,
  Kuzzle = require('../../../../lib/api/kuzzle'),
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError;

describe('Test: hotelClerk.countSubscription', () => {
  let
    kuzzle;

  before(() => {
    kuzzle = new Kuzzle();
  });

  it('should reject the request if the provided room ID is unknown to Kuzzle', () => {
    const request = new Request({body: {roomId: 'foobar'}});

    return should(() => kuzzle.hotelClerk.countSubscription(request))
      .throw(NotFoundError, {message: 'The room Id "foobar" does not exist.'});
  });

  it('should return the right subscriptions count when handling a correct request', () => {
    const request = new Request({body: {roomId: 'foobar'}});

    kuzzle.hotelClerk.rooms.foobar = {customers: new Set(['foo', 'bar'])};

    const response = kuzzle.hotelClerk.countSubscription(request);

    should(response.count)
      .be.exactly(2);
  });
});
