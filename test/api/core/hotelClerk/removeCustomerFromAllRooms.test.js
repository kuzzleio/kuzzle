const
  should = require('should'),
  sinon = require('sinon'),
  Request = require('kuzzle-common-objects').Request,
  RequestContext = require('kuzzle-common-objects').models.RequestContext,
  HotelClerk = require('../../../../lib/api/core/hotelClerk'),
  KuzzleMock = require('../../../mocks/kuzzle.mock');

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

    hotelClerk.customers = {
      [connectionId]: {
        foo: null,
        bar: {volatile: 'data'}
      },
      a: {
        foo: null
      },
      b: {
        foo: null
      }
    };

    hotelClerk.rooms = {
      'foo': {
        customers: new Set([connectionId, 'a', 'b']),
        index,
        collection,
        channels: ['foobar']
      },
      'bar': {
        customers: new Set([connectionId]),
        index,
        collection,
        channels: ['barfoo']
      }
    };

    hotelClerk.roomsCount = 2;
  });

  it('should do nothing when a bad connectionId is given', () => {
    const fakeContext = new RequestContext({connection: {id: 'unknown'}});
    hotelClerk._removeRoomForCustomer = sinon.stub();

    hotelClerk.removeCustomerFromAllRooms(fakeContext);
    should(hotelClerk._removeRoomForCustomer).not.be.called();
    should(hotelClerk.roomsCount).be.eql(2);
  });

  it('should clean up customers, rooms object', () => {
    hotelClerk.removeCustomerFromAllRooms(context);

    should(kuzzle.realtime.remove).be.calledOnce();
    should(kuzzle.notifier.notifyUser).be.calledTwice();

    should(kuzzle.notifier.notifyUser.args[0][1]).be.instanceOf(Request);
    should(kuzzle.notifier.notifyUser.args[0][1].input.controller).be.exactly('realtime');
    should(kuzzle.notifier.notifyUser.args[0][1].input.action).be.exactly('unsubscribe');
    should(kuzzle.notifier.notifyUser.args[0][1].input.resource.index).be.exactly(index);
    should(kuzzle.notifier.notifyUser.args[0][2]).be.exactly('out');

    should(hotelClerk.rooms)
      .match({
        foo: {
          customers: new Set(['a', 'b']),
          index,
          collection
        }
      });
    should(hotelClerk.rooms.bar).be.undefined();

    should(hotelClerk.customers)
      .match({
        a: {
          foo: null
        },
        b: {
          foo: null
        }
      });

    should(hotelClerk.roomsCount).be.eql(1);
  });

  it('should log an error if a problem occurs while unsubscribing', function () {
    const error = new Error('Mocked error');
    kuzzle.realtime.remove = sinon.stub().throws(error);

    hotelClerk.removeCustomerFromAllRooms(context);

    should(kuzzle.pluginsManager.trigger).be.calledWith('log:error', error);

    // the room should be removed from the hotel clerk even if Koncorde fails
    should(hotelClerk.roomsCount).be.eql(1);
    should(hotelClerk.rooms.bar).be.undefined();
  });
});
