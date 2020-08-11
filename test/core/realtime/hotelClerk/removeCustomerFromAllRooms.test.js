'use strict';

const should = require('should');
const sinon = require('sinon');
const {
  RequestContext,
  Request,
} = require('kuzzle-common-objects');
const HotelClerk = require('../../../../lib/core/realtime/hotelClerk');
const KuzzleMock = require('../../../mocks/kuzzle.mock');

describe('Test: hotelClerk.removeCustomerFromAllRooms', () => {
  let
    kuzzle,
    hotelClerk,
    connectionId = 'connectionid',
    collection = 'user',
    index = '%test',
    context;

  beforeEach(() => {
    context = new RequestContext({connection: {id: connectionId}});
    kuzzle = new KuzzleMock();
    hotelClerk = new HotelClerk(kuzzle);

    hotelClerk.customers.set(connectionId, new Map([
      [ 'foo', null ],
      [ 'bar', { volatile: 'data' } ]
    ]));
    hotelClerk.customers.set('a', new Map([['foo', null]]));
    hotelClerk.customers.set('b', new Map([['foo', null]]));

    hotelClerk.rooms.set('foo', {
      customers: new Set([connectionId, 'a', 'b']),
      index,
      collection,
      channels: ['foobar']
    });
    hotelClerk.rooms.set('bar', {
      customers: new Set([connectionId]),
      index,
      collection,
      channels: ['barfoo']
    });

    hotelClerk.roomsCount = 2;
  });

  it('should do nothing when a bad connectionId is given', () => {
    const fakeContext = new RequestContext({connection: {id: 'unknown'}});
    hotelClerk._removeRoomForCustomer = sinon.stub();

    return hotelClerk.removeCustomerFromAllRooms(fakeContext)
      .then(() => {
        should(hotelClerk._removeRoomForCustomer).not.be.called();
        should(hotelClerk.roomsCount).be.eql(2);
      });
  });

  it('should clean up customers, rooms object', async () => {
    await hotelClerk.removeCustomerFromAllRooms(context);

    should(kuzzle.koncorde.remove).be.calledOnce();

    should(hotelClerk.rooms).have.value('foo', {
      customers: new Set(['a', 'b']),
      index,
      collection,
      channels: ['foobar']
    });
    should(hotelClerk.rooms).not.have.key('bar');

    should(hotelClerk.customers.get('a')).have.value('foo', null);
    should(hotelClerk.customers.get('b')).have.value('foo', null);
    should(hotelClerk.roomsCount).be.eql(1);
  });

  it('should notify the unsubscriptions', () => {
    return hotelClerk.removeCustomerFromAllRooms(context)
      .then(() => {
        should(kuzzle.notifier.notifyUser).be.calledTwice();

        should(kuzzle.notifier.notifyUser.args[0][1])
          .be.instanceOf(Request);

        should(kuzzle.notifier.notifyUser.args[0][1].input.controller)
          .be.exactly('realtime');

        should(kuzzle.notifier.notifyUser.args[0][1].input.action)
          .be.exactly('unsubscribe');

        should(kuzzle.notifier.notifyUser.args[0][1].input.resource.index)
          .be.exactly(index);

        should(kuzzle.notifier.notifyUser.args[0][2]).be.exactly('out');
      });
  });

  it('should log an error if a problem occurs while unsubscribing', () => {
    const error = new Error('Mocked error');
    kuzzle.koncorde.remove = sinon.stub().throws(error);

    return hotelClerk.removeCustomerFromAllRooms(context)
      .then(() => {
        should(kuzzle.log.error).be.calledWith(error);

        // the room should be removed from the hotel clerk even if
        // Koncorde fails
        should(hotelClerk.roomsCount).be.eql(1);
        should(hotelClerk.rooms).not.have.key('bar');
      });
  });
});
