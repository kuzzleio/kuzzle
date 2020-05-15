'use strict';

const should = require('should');
const sinon = require('sinon');
const { Request } = require('kuzzle-common-objects');
const HotelClerk = require('../../../../lib/core/realtime/hotelClerk');
const KuzzleMock = require('../../../mocks/kuzzle.mock');

describe('Test: hotelClerk.removeSubscription', () => {
  let
    kuzzle,
    hotelClerk,
    request;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    hotelClerk = new HotelClerk(kuzzle);

    request = new Request({
      controller: 'realtime',
      action: 'unsubscribe',
      index: 'foo',
      collection: 'bar',
      body: { roomId: 'foo' }
    });
  });

  it('should act as a simple wrapper to _removeRoomForCustomer', () => {
    sinon.stub(hotelClerk, '_removeRoomForCustomer').resolves();

    return hotelClerk.removeSubscription(request)
      .then(() => {
        should(hotelClerk._removeRoomForCustomer)
          .calledOnce()
          .calledWith(request.context, request.input.body.roomId);
      });
  });
});
