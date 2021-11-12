'use strict';

const should = require('should');
const sinon = require('sinon');

const KuzzleMock = require('../../../mocks/kuzzle.mock');

const { HotelClerk } = require('../../../../lib/core/realtime/hotelClerk');
const { ConnectionRooms } = require('../../../../lib/core/realtime/connectionRooms');

describe('HotelClerk', () => {
  let kuzzle;
  let hotelClerk;
  let realtimeModule;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    hotelClerk = new HotelClerk(realtimeModule);

    realtimeModule = {};

    hotelClerk.subscriptions.set('a', new ConnectionRooms(new Map([['foo', null]])));
    hotelClerk.subscriptions.set('b', new ConnectionRooms(new Map([['foo', null]])));

    return hotelClerk.init();
  });

  describe('#clearConnections', () => {
    it('should have been registered with the "core:realtime:shutdown" event', async () => {
      sinon.stub(hotelClerk, 'clearConnections').resolves();

      kuzzle.pipe.restore();
      await kuzzle.pipe('kuzzle:shutdown');

      should(hotelClerk.clearConnections).be.calledOnce();
    });

    it('should properly remove each connection', async () => {
      sinon.stub(hotelClerk, 'removeConnection').resolves();

      await hotelClerk.clearConnections();

      should(hotelClerk.removeConnection)
        .be.calledTwice()
        .be.calledWith('a')
        .be.calledWith('b');
    });
  });
});
