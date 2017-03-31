const
  Promise = require('bluebird'),
  rewire = require('rewire'),
  sinon = require('sinon'),
  should = require('should'),
  HotelClerk = rewire('../../../../lib/api/core/hotelClerk'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  RequestContext = require('kuzzle-common-objects').models.RequestContext;

describe ('lib/core/hotelclerck:removeRoomForCustomer', () => {
  let
    context,
    cleanUpRooms,       // eslint-disable-line no-unused-vars
    removeRoomForCustomers,
    requestContext,
    reset;

  beforeEach(() => {
    context = {
      customers: {},
      rooms: {
        roomId: {
          channels: {
            ch1: true,
            ch2: true
          },
          customers: ['connectionId']
        }
      },
      kuzzle: new KuzzleMock()
    };

    cleanUpRooms = sinon.stub().returns(Promise.resolve());
    reset = HotelClerk.__set__({
      cleanUpRooms
    });

    requestContext = new RequestContext({
      connectionId: 'connectionId',
      protocol: 'protocol'
    });

    removeRoomForCustomers = HotelClerk.__get__('removeRoomForCustomer').bind(context);
  });

  afterEach(() => {
    reset();
  });

  it('should reject if the connection cannot be found', () => {
    return should(removeRoomForCustomers(requestContext, 'roomId'))
      .be.rejectedWith(NotFoundError);
  });

  it('should reject if the customer did not subscribe to the room', () => {
    context.customers.connectionId = {};

    return should(removeRoomForCustomers(requestContext, 'roomId'))
      .be.rejectedWith(NotFoundError);
  });

  it('should remove the room from the customer list and remove the connection entry if empty', () => {
    context.customers.connectionId = {roomId: null};

    return removeRoomForCustomers(requestContext, 'roomId', false)
      .then(roomId => {
        should(context.customers)
          .be.empty();

        should(cleanUpRooms)
          .be.calledOnce();

        should(roomId)
          .be.eql('roomId');
      });
  });

  it('should remove the room from the customer list and keep other existing rooms', () => {
    context.customers.connectionId = {
      roomId: null,
      anotherRoom: null
    };

    return removeRoomForCustomers(requestContext, 'roomId', false)
      .then(() => {
        should(context.customers.connectionId)
          .eql({
            anotherRoom: null
          });
      });

  });

});
