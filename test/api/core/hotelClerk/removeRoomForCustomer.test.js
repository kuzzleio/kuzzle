const
  sinon = require('sinon'),
  should = require('should'),
  HotelClerk = require('../../../../lib/api/core/hotelClerk'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  Request = require('kuzzle-common-objects').Request, 
  RequestContext = require('kuzzle-common-objects').models.RequestContext;

describe ('lib/core/hotelclerk:removeRoomForCustomer', () => {
  let
    requestContext,
    kuzzle,
    hotelClerk;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    hotelClerk = new HotelClerk(kuzzle);

    hotelClerk.customers = {};
    hotelClerk.rooms = {
      roomId: {
        channels: {
          ch1: true,
          ch2: true
        },
        customers: new Set(['connectionId'])
      }
    };

    hotelClerk.roomsCount = 1;

    hotelClerk._removeRoomFromRealtimeEngine = sinon.spy();

    requestContext = new RequestContext({
      connectionId: 'connectionId',
      protocol: 'protocol'
    });

  });

  it('should throw if the room cannot be found', () => {
    return should(() => hotelClerk._removeRoomForCustomer(requestContext, 'idontexist'))
      .throw(NotFoundError);
  });

  it('should throw if the customer did not subscribe to the room', () => {
    hotelClerk.customers.connectionId = {};
    should(() => hotelClerk._removeRoomForCustomer(requestContext, 'roomId')).throw(NotFoundError);
    should(hotelClerk.rooms.roomId).not.be.undefined();
    should(hotelClerk.roomsCount).be.eql(1);
    should(kuzzle.notifier.notifyUser).not.be.called();
  });

  it('should remove the room from the customer list and remove the connection entry if empty', () => {
    hotelClerk.customers.connectionId = {roomId: null};

    const response = hotelClerk._removeRoomForCustomer(requestContext, 'roomId', false);
    should(hotelClerk.customers).be.empty();

    should(hotelClerk._removeRoomFromRealtimeEngine)
      .be.calledOnce()
      .be.calledWith('roomId');

    should(response).be.eql('roomId');
    should(hotelClerk.roomsCount).be.eql(0);
    should(hotelClerk.rooms).be.an.Object().and.be.empty();

    // should not notify since nobody else is listening
    should(kuzzle.notifier.notifyUser).not.be.called();
  });

  it('should remove the room from the customer list and keep other existing rooms', () => {
    hotelClerk.customers.connectionId = {
      roomId: null,
      anotherRoom: null
    };

    hotelClerk.rooms.anotherRoom = {};
    hotelClerk.roomsCount = 2;

    hotelClerk._removeRoomForCustomer(requestContext, 'roomId', false);
    should(hotelClerk.customers.connectionId)
      .eql({
        anotherRoom: null
      });

    should(hotelClerk.rooms.roomId).be.undefined();
    should(hotelClerk.rooms.anotherRoom).not.be.undefined();
    should(hotelClerk.roomsCount).be.eql(1);

    // should not notify since nobody else is listening
    should(kuzzle.notifier.notifyUser).not.be.called();
  });

  it('should remove a customer and notify other users in the room', () => {
    hotelClerk.customers = {
      connectionId: {roomId: null},
      foobar: {roomId: null}
    };

    hotelClerk.rooms.roomId.customers.add('foobar');

    hotelClerk._removeRoomForCustomer(requestContext, 'roomId');

    should(hotelClerk.rooms.roomId).not.be.undefined();
    should(hotelClerk.rooms.roomId.customers.size).be.eql(1);
    should(hotelClerk.rooms.roomId.customers.has('foobar')).be.true();
    should(hotelClerk.rooms.roomId.customers.has(requestContext.connectionId)).be.false();

    should(hotelClerk.roomsCount).be.eql(1);
    should(kuzzle.notifier.notifyUser).calledWithMatch('roomId', sinon.match.instanceOf(Request), 'out', {count: 1});
  });
});
