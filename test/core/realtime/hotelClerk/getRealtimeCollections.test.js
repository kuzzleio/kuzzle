'use strict';

const should = require('should');
const KuzzleMock = require('../../../mocks/kuzzle.mock');
const HotelClerck = require('../../../../lib/core/realtime/hotelClerk');

describe('Test: hotelClerk.getRealtimeCollections', () => {
  let
    kuzzle,
    hotelClerk;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    kuzzle.koncorde.getCollections.returns([]);

    hotelClerk = new HotelClerck(kuzzle);
  });

  it('should return an empty array if there is no subscription', () => {
    should(hotelClerk.getRealtimeCollections('index'))
      .be.an.Array()
      .and.be.empty();
  });

  it('should return an array of unique collection names', () => {
    kuzzle.koncorde.getCollections.withArgs('index').returns(['foo', 'bar']);
    kuzzle.koncorde.getCollections.withArgs('anotherIndex').returns(['baz']);

    should(hotelClerk.getRealtimeCollections('index')).match(['foo', 'bar']);
  });
});
