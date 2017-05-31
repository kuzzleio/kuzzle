const
  sinon = require('sinon'),
  should = require('should'),
  Dsl = require('../../../../lib/api/dsl'),
  HotelClerk = require('../../../../lib/api/core/hotelClerk'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  RequestContext = require('kuzzle-common-objects').models.RequestContext;

describe ('lib/core/hotelclerk:removeRoomForCustomer', () => {
  let
    requestContext,
    kuzzle,
    hotelClerk;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    kuzzle.dsl = new Dsl(kuzzle);
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
    hotelClerk._removeRoomFromDsl = sinon.spy();

    requestContext = new RequestContext({
      connectionId: 'connectionId',
      protocol: 'protocol'
    });

  });

  it('should throw if the room cannot be found', () => {
    return should(() => hotelClerk._removeRoomForCustomer(requestContext, 'idontexist'))
      .throw(NotFoundError);
  });

  it('should process without error if the customer did not subscribe to the room', () => {
    hotelClerk.customers.connectionId = {};
    hotelClerk._removeRoomForCustomer(requestContext, 'roomId');
  });

  it('should remove the room from the customer list and remove the connection entry if empty', () => {
    hotelClerk.customers.connectionId = {roomId: null};

    const response = hotelClerk._removeRoomForCustomer(requestContext, 'roomId', false);
    should(hotelClerk.customers)
      .be.empty();

    should(hotelClerk._removeRoomFromDsl)
      .be.calledOnce()
      .be.calledWith('roomId');

    should(response)
      .be.eql('roomId');
  });

  it('should remove the room from the customer list and keep other existing rooms', () => {
    hotelClerk.customers.connectionId = {
      roomId: null,
      anotherRoom: null
    };

    hotelClerk._removeRoomForCustomer(requestContext, 'roomId', false);
    should(hotelClerk.customers.connectionId)
      .eql({
        anotherRoom: null
      });
  });

});
