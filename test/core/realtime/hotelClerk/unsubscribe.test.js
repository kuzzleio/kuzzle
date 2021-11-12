'use strict';

const sinon = require('sinon');
const should = require('should');

const {
  Request,
  PreconditionError,
  NotFoundError,
} = require('../../../../index');
const KuzzleMock = require('../../../mocks/kuzzle.mock');

const { HotelClerk } = require('../../../../lib/core/realtime/hotelClerk');
const { Room } = require('../../../../lib/core/realtime/room');
const { Channel } = require('../../../../lib/core/realtime/channel');
const { ConnectionRooms } = require('../../../../lib/core/realtime/connectionRooms');

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

    hotelClerk.subscriptions.clear();
    hotelClerk.rooms.set(roomId, new Room(
      roomId,
      'index',
      'collection',
      new Map([
        ['ch1', new Channel(roomId, { cluster: true })],
        ['ch2', new Channel(roomId, { cluster: true })]
      ]),
      new Set([connectionId]),
    ));

    hotelClerk.roomsCount = 1;

    sinon.spy(hotelClerk, 'removeRoom');

    kuzzle.tokenManager.getKuidFromConnection.returns(null);

    return hotelClerk.init();
  });

  it('should register an "unsubscribe" event', async () => {
    sinon.stub(hotelClerk, 'unsubscribe');

    kuzzle.ask.restore();
    await kuzzle.ask('core:realtime:unsubscribe', 'cnx', 'room', 'notify');

    should(hotelClerk.unsubscribe).calledWith('cnx', 'room', 'notify');
  });

  it('should reject if the customer cannot be found', () => {
    return hotelClerk.unsubscribe('connectionId', 'idontexist')
      .should.be.rejectedWith(PreconditionError, {
        id: 'core.realtime.not_subscribed',
      });
  });

  it('should reject if the customer did not subscribe to the room', async () => {
    hotelClerk.subscriptions.set(connectionId, new ConnectionRooms());

    await should(hotelClerk.unsubscribe(connectionId, roomId))
      .rejectedWith(PreconditionError, { id: 'core.realtime.not_subscribed' });

    should(hotelClerk.rooms).have.key(roomId);
    should(hotelClerk.roomsCount).be.eql(1);
    should(realtimeModule.notifier.notifyUser).not.be.called();
  });

  it('should reject if the room does not exist', () => {
    hotelClerk.subscriptions.set(connectionId, new ConnectionRooms(new Map([
      [ 'nowhere', null ]
    ])));

    return hotelClerk.unsubscribe(connectionId, 'nowhere')
      .should.be.rejectedWith(NotFoundError, {
        id: 'core.realtime.room_not_found',
      });
  });

  it('should remove the room from the customer list and remove the connection entry if empty', async () => {
    kuzzle.tokenManager.getKuidFromConnection.returns('Umraniye');
    hotelClerk.subscriptions.set(connectionId, new ConnectionRooms(new Map([
      [ roomId, null ]
    ])));

    await hotelClerk.unsubscribe(connectionId, roomId);

    should(hotelClerk.subscriptions).be.empty();

    should(hotelClerk.removeRoom)
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
    hotelClerk.subscriptions.set(connectionId, new ConnectionRooms(new Map([
      [ roomId, null ],
      [ 'anotherRoom', null ]
    ])));

    hotelClerk.rooms.set('anotherRoom', {});
    hotelClerk.roomsCount = 2;

    await hotelClerk.unsubscribe(connectionId, roomId);

    const connectionRooms = hotelClerk.subscriptions.get('connectionId');
    should(connectionRooms.getVolatile('anotherRoom')).be.eql(null);

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
    hotelClerk.subscriptions.set(connectionId, new ConnectionRooms(new Map([
      [ roomId, null ]
    ])));
    hotelClerk.subscriptions.set('foobar', new ConnectionRooms(new Map([
      [ roomId, null ]
    ])));
    hotelClerk.rooms.get(roomId).connections.add('foobar');

    await hotelClerk.unsubscribe(connectionId, roomId);

    should(hotelClerk.rooms).have.key(roomId);
    should(hotelClerk.rooms.get(roomId).connections).have.size(1);
    should(hotelClerk.rooms.get(roomId).connections).have.key('foobar');
    should(hotelClerk.rooms.get(roomId).connections).not.have.key(connectionId);

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
