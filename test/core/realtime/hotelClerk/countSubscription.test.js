'use strict';

const should = require('should');
const {
  Request,
  NotFoundError
} = require('kuzzle-common-objects');
const Kuzzle = require('../../../../lib/kuzzle');
const config = require('../../../../lib/config');

describe('Test: hotelClerk.countSubscription', () => {
  let
    kuzzle;

  before(() => {
    kuzzle = new Kuzzle(config);
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
