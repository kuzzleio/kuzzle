'use strict';

const
  should = require('should'),
  {
    Request,
    errors: { NotFoundError }
  } = require('kuzzle-common-objects'),
  Kuzzle = require('../../../lib/kuzzle');

describe('Test: hotelClerk.countSubscription', () => {
  let
    kuzzle;

  before(() => {
    kuzzle = new Kuzzle();
  });

  it('should reject the request if the provided room ID is unknown to Kuzzle', () => {
    const request = new Request({body: {roomId: 'foobar'}});

    return should(() => kuzzle.hotelClerk.countSubscription(request))
      .throw(NotFoundError, { id: 'core.realtime.room_not_found' });
  });

  it('should return the right subscriptions count when handling a correct request', () => {
    const request = new Request({body: {roomId: 'foobar'}});

    kuzzle.hotelClerk.rooms.set('foobar', {customers: new Set(['foo', 'bar'])});

    const response = kuzzle.hotelClerk.countSubscription(request);

    should(response.count)
      .be.exactly(2);
  });
});
