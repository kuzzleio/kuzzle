'use strict';

const should = require('should');
const sinon = require('sinon');
const { NotFoundError } = require('kuzzle-common-objects');

const KuzzleMock = require('../../../mocks/kuzzle.mock');

const HotelClerk = require('../../../../lib/core/realtime/hotelClerk');

describe('Test: hotelClerk.getRoomSize', () => {
  let kuzzle;
  let hotelClerk;

  before(() => {
    kuzzle = new KuzzleMock();
    hotelClerk = new HotelClerk(kuzzle, {});

    return hotelClerk.init();
  });

  it('should register a "room:size" event', async () => {
    sinon.stub(hotelClerk, 'getRoomSize');

    kuzzle.ask.restore();
    await kuzzle.ask('core:realtime:room:size:get', 'foo');

    should(hotelClerk.getRoomSize).calledWith('foo');
  });

  it('should reject if the provided room ID is unknown', () => {
    return should(() => hotelClerk.getRoomSize('foobar')).throw(NotFoundError, {
      id: 'core.realtime.room_not_found',
    });
  });

  it('should return the right subscriptions count', () => {
    hotelClerk.rooms.set('foobar', {customers: new Set(['foo', 'bar'])});

    should(hotelClerk.getRoomSize('foobar')).eql(2);
  });
});
