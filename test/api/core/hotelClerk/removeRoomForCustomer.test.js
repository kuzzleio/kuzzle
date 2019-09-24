const
  sinon = require('sinon'),
  should = require('should'),
  HotelClerk = require('../../../../lib/api/core/hotelClerk'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  {
    Request,
    models: { RequestContext },
    errors: {
      PreconditionError,
      NotFoundError
    }
  } = require('kuzzle-common-objects');

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
      connection: {
        id: 'connectionId',
        protocol: 'protocol'
      }
    });

  });

  it('should reject if the customer cannot be found', () => {
    return hotelClerk._removeRoomForCustomer(requestContext, 'idontexist')
      .should.be.rejectedWith(PreconditionError, {
        errorName: 'core.realtime.not_subscribed'
      });
  });

  it('should reject if the customer did not subscribe to the room', done => {
    hotelClerk.customers.connectionId = {};

    hotelClerk._removeRoomForCustomer(requestContext, 'roomId')
      .then(() => done(new Error('expected a promise rejection')))
      .catch(err => {
        try {
          should(err).be.instanceOf(PreconditionError);
          should(err.errorName).eql('core.realtime.not_subscribed');
          should(hotelClerk.rooms.roomId).not.be.undefined();
          should(hotelClerk.roomsCount).be.eql(1);
          should(kuzzle.notifier.notifyUser).not.be.called();
          done();
        } catch(e) {
          done(e);
        }
      });
  });

  it('should reject if the room does not exist', () => {
    hotelClerk.customers.connectionId = {nowhere: null};

    return hotelClerk._removeRoomForCustomer(requestContext, 'nowhere', false)
      .should.be.rejectedWith(NotFoundError, {
        errorName: 'core.realtime.room_not_found'
      });
  });

  it('should remove the room from the customer list and remove the connection entry if empty', () => {
    hotelClerk.customers.connectionId = {roomId: null};

    return hotelClerk._removeRoomForCustomer(requestContext, 'roomId', false)
      .then(response => {
        should(hotelClerk.customers).be.empty();

        should(hotelClerk._removeRoomFromRealtimeEngine)
          .be.calledOnce()
          .be.calledWith('roomId');

        should(response).be.eql('roomId');
        should(hotelClerk.roomsCount).be.eql(0);
        should(hotelClerk.rooms).be.an.Object().and.be.empty();

        // should still notify even if nobody is listening for cluster mode
        should(kuzzle.notifier.notifyUser).be.calledOnce();
      });
  });

  it('should remove the room from the customer list and keep other existing rooms', () => {
    hotelClerk.customers.connectionId = {
      roomId: null,
      anotherRoom: null
    };

    hotelClerk.rooms.anotherRoom = {};
    hotelClerk.roomsCount = 2;

    return hotelClerk._removeRoomForCustomer(requestContext, 'roomId', false)
      .then(() => {
        should(hotelClerk.customers.connectionId)
          .eql({
            anotherRoom: null
          });

        should(hotelClerk.rooms.roomId).be.undefined();
        should(hotelClerk.rooms.anotherRoom).not.be.undefined();
        should(hotelClerk.roomsCount).be.eql(1);

        // should still notify even if nobody is listening for cluster mode
        should(kuzzle.notifier.notifyUser).be.calledOnce();
      });
  });

  it('should remove a customer and notify other users in the room', () => {
    hotelClerk.customers = {
      connectionId: {roomId: null},
      foobar: {roomId: null}
    };

    hotelClerk.rooms.roomId.customers.add('foobar');

    return hotelClerk._removeRoomForCustomer(requestContext, 'roomId')
      .then(() => {
        should(hotelClerk.rooms.roomId).not.be.undefined();
        should(hotelClerk.rooms.roomId.customers.size).be.eql(1);
        should(hotelClerk.rooms.roomId.customers.has('foobar')).be.true();
        should(hotelClerk.rooms.roomId.customers.has(requestContext.connectionId))
          .be.false();

        should(hotelClerk.roomsCount).be.eql(1);
        should(kuzzle.notifier.notifyUser).calledWithMatch(
          'roomId', sinon.match.instanceOf(Request), 'out', {count: 1});
      });
  });
});
