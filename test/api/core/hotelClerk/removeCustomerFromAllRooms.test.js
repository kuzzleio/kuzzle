const
  should = require('should'),
  sinon = require('sinon'),
  Request = require('kuzzle-common-objects').Request,
  RequestContext = require('kuzzle-common-objects').models.RequestContext,
  Dsl = require('../../../../lib/api/dsl'),
  HotelClerk = require('../../../../lib/api/core/hotelClerk'),
  KuzzleMock = require('../../../mocks/kuzzle.mock');

describe('Test: hotelClerk.removeCustomerFromAllRooms', () => {
  let
    kuzzle,
    connectionId = 'connectionid',
    collection = 'user',
    index = '%test',
    context;

  beforeEach(() => {
    context = new RequestContext({connectionId});
    kuzzle = new KuzzleMock();
    kuzzle.hotelClerk = new HotelClerk(kuzzle);
    kuzzle.dsl = new Dsl();

    kuzzle.hotelClerk.customers = {
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

    kuzzle.hotelClerk.rooms = {
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
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should do nothing when a bad connectionId is given', () => {
    context.connectionId = 'unknown';
    kuzzle.hotelClerk._removeRoomForCustomer = sinon.stub();

    kuzzle.hotelClerk.removeCustomerFromAllRooms(context);
    should(kuzzle.hotelClerk._removeRoomForCustomer)
      .not.be.called();
  });

  it('should clean up customers, rooms object', () => {
    kuzzle.dsl.remove = sinon.stub();

    kuzzle.hotelClerk.removeCustomerFromAllRooms(context);

    should(kuzzle.dsl.remove).be.calledOnce();
    should(kuzzle.notifier.notifyUser).be.calledOnce();
    // testing requestObject argument
    should(kuzzle.notifier.notifyUser.args[0][1]).be.instanceOf(Request);
    should(kuzzle.notifier.notifyUser.args[0][1].input.controller).be.exactly('realtime');
    should(kuzzle.notifier.notifyUser.args[0][1].input.action).be.exactly('unsubscribe');
    should(kuzzle.notifier.notifyUser.args[0][1].input.resource.index).be.exactly(index);
    should(kuzzle.notifier.notifyUser.args[0][2]).be.exactly('out');

    should(kuzzle.hotelClerk.rooms)
      .match({
        foo: {
          customers: new Set(['a', 'b']),
          index,
          collection
        }
      });

    should(kuzzle.hotelClerk.customers)
      .match({
        a: {
          foo: null
        },
        b: {
          foo: null
        }
      });
  });

  it('should log an error if a problem occurs while unsubscribing', function () {
    const error = new Error('Mocked error');
    kuzzle.dsl.remove = sinon.stub().throws(error);

    kuzzle.hotelClerk.removeCustomerFromAllRooms(context);

    should(kuzzle.pluginsManager.trigger)
      .be.calledWith('log:error', error);
  });
});
