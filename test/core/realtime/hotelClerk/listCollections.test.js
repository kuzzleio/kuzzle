'use strict';

const should = require('should');
const sinon = require('sinon');

const KuzzleMock = require('../../../mocks/kuzzle.mock');

const HotelClerk = require('../../../../lib/core/realtime/hotelClerk');

describe('Test: hotelClerk.listCollections', () => {
  let kuzzle;
  let hotelClerk;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    kuzzle.koncorde.getIndexes.returns([]);

    hotelClerk = new HotelClerk({});

    return hotelClerk.init();
  });

  it('should register a "collections:get" event', async () => {
    sinon.stub(hotelClerk, 'listCollections');

    kuzzle.ask.restore();
    await kuzzle.ask('core:realtime:collections:get', 'index');

    should(hotelClerk.listCollections).calledWith('index');
  });

  it('should return an empty array if there is no subscription', () => {
    should(hotelClerk.listCollections('index'))
      .be.an.Array()
      .and.be.empty();
  });

  it('should return an array of unique collection names', () => {
    kuzzle.koncorde.getIndexes.returns([
      'index/foo',
      'index/bar',
      'anotherIndex/baz',
    ]);

    should(hotelClerk.listCollections('index')).match(['foo', 'bar']);
  });
});
