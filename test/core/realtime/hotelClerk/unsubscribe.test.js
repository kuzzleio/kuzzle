'use strict';

const sinon = require('sinon');
const should = require('should');

const {
  Request,
  PreconditionError,
  NotFoundError,
} = require('../../../../index');
const KuzzleMock = require('../../../mocks/kuzzle.mock');

const HotelClerk = require('../../../../lib/core/realtime/hotelClerk');

describe('Test: hotelClerk.unsubscribe', () => {
  const connectionId = 'connectionId';
  const roomId = 'roomId';
  let kuzzle;
  let hotelClerk;
  let realtimeModule;

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    realtimeModule = {
      notifier: {
        notifyUser: sinon.stub(),
      }
    };

    hotelClerk = new HotelClerk(realtimeModule);

    hotelClerk.customers.clear();
    hotelClerk.rooms.set(roomId, {
      channels: {
        ch1: { cluster: true },
        ch2: { cluster: true }
      },
      customers: new Set([connectionId]),
      index: 'index',
      collection: 'collection',
    });

    hotelClerk.roomsCount = 1;

    hotelClerk._removeRoomFromRealtimeEngine = sinon.spy();

    return hotelClerk.init();
  });

  it('should register an "unsubscribe" event', async () => {
    sinon.stub(hotelClerk, 'unsubscribe');

    kuzzle.ask.restore();
    await kuzzle.ask('core:realtime:unsubscribe', 'cnx', 'room', null, 'notify');

    should(hotelClerk.unsubscribe).calledWith('cnx', 'room', null, 'notify');
  });

  it('should reject if the customer cannot be found', () => {
    return hotelClerk.unsubscribe('connectionId', 'idontexist', null)
      .should.be.rejectedWith(PreconditionError, {
        id: 'core.realtime.not_subscribed',
      });
  });

  it('should reject if the customer did not subscribe to the room', async () => {
    hotelClerk.customers.set(connectionId, new Map([]));

    await should(hotelClerk.unsubscribe(connectionId, roomId, null))
      .rejectedWith(PreconditionError, { id: 'core.realtime.not_subscribed' });

    should(hotelClerk.rooms).have.key(roomId);
    should(hotelClerk.roomsCount).be.eql(1);
    should(realtimeModule.notifier.notifyUser).not.be.called();
  });

  it('should reject if the room does not exist', () => {
    hotelClerk.customers.set(connectionId, new Map([
      [ 'nowhere', null ]
    ]));

    return hotelClerk.unsubscribe(connectionId, 'nowhere', null)
      .should.be.rejectedWith(NotFoundError, {
        id: 'core.realtime.room_not_found',
      });
  });

  it('should remove the room from the customer list and remove the connection entry if empty', async () => {
    hotelClerk.customers.set(connectionId, new Map([
      [ roomId, null ]
    ]));

    await hotelClerk.unsubscribe(connectionId, roomId, 'Umraniye');

    should(hotelClerk.customers).be.empty();

    should(hotelClerk._removeRoomFromRealtimeEngine)
      .be.calledOnce()
      .be.calledWith(roomId);

    should(hotelClerk.roomsCount).be.eql(0);
    should(hotelClerk.rooms).be.empty();

    // should still notify even if nobody is listening for cluster mode
    should(realtimeModule.notifier.notifyUser).calledWithMatch(
      roomId,
      {
        input: {
          resource: { index: 'index', collection: 'collection' },
          action: 'unsubscribe',
          controller: 'realtime',
          volatile: null,
        },
      },
      'out',
      { count: 0 });
    should(kuzzle.emit).be.calledWithMatch('core:realtime:user:unsubscribe:after', {
      requestContext: {
        connection: {
          id: connectionId
        }
      },
      room: {
        collection: 'collection',
        id: roomId,
        index: 'index',
      },
      subscription: {
        index: 'index',
        collection: 'collection',
        filters: undefined,
        roomId,
        connectionId,
        kuid: 'Umraniye',
      }
    });
  });

  it('should remove the room from the customer list and keep other existing rooms', async () => {
    hotelClerk.customers.set(connectionId, new Map([
      [ roomId, null ],
      [ 'anotherRoom', null ]
    ]));

    hotelClerk.rooms.set('anotherRoom', {});
    hotelClerk.roomsCount = 2;

    await hotelClerk.unsubscribe(connectionId, roomId, null);

    should(hotelClerk.customers.get('connectionId')).have.value(
      'anotherRoom',
      null);

    should(hotelClerk.rooms).not.have.key('roomId');
    should(hotelClerk.rooms).have.key('anotherRoom');
    should(hotelClerk.roomsCount).be.eql(1);

    // should still notify even if nobody is listening for cluster mode
    should(realtimeModule.notifier.notifyUser).calledWithMatch(
      roomId,
      {
        input: {
          resource: { index: 'index', collection: 'collection' },
          action: 'unsubscribe',
          controller: 'realtime',
          volatile: null,
        },
      },
      'out',
      { count: 0 });
  });

  it('should remove a customer and notify other users in the room', async () => {
    hotelClerk.customers.set(connectionId, new Map([
      [ roomId, null ]
    ]));
    hotelClerk.customers.set('foobar', new Map([
      [ roomId, null ]
    ]));
    hotelClerk.rooms.get(roomId).customers.add('foobar');

    await hotelClerk.unsubscribe(connectionId, roomId, null);

    should(hotelClerk.rooms).have.key(roomId);
    should(hotelClerk.rooms.get(roomId).customers).have.size(1);
    should(hotelClerk.rooms.get(roomId).customers).have.key('foobar');
    should(hotelClerk.rooms.get(roomId).customers).not.have.key(connectionId);

    should(hotelClerk.roomsCount).be.eql(1);
    should(realtimeModule.notifier.notifyUser).calledWithMatch(
      roomId,
      sinon.match.instanceOf(Request),
      'out',
      {count: 1});

    should(kuzzle.pipe).be.calledWithMatch(
      'core:realtime:unsubscribe:after',
      roomId);
  });
});
