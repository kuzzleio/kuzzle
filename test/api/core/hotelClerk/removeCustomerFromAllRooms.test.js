var
  should = require('should'),
  Promise = require('bluebird'),
  sinon = require('sinon'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  Dsl = require('../../../../lib/api/dsl'),
  HotelClerk = require('../../../../lib/api/core/hotelClerk'),
  Kuzzle = require('../../../mocks/kuzzle.mock');

describe('Test: hotelClerk.removeCustomerFromAllRooms', () => {
  var
    kuzzle,
    connection = {id: 'connectionid'},
    collection = 'user',
    index = '%test',
    sandbox;

  beforeEach(() => {
    kuzzle = new Kuzzle();
    kuzzle.hotelClerk = new HotelClerk(kuzzle);
    kuzzle.dsl = new Dsl();

    sandbox = sinon.sandbox.create();

    kuzzle.hotelClerk.customers[connection.id] = {
      'foo': {},
      'bar': {}
    };

    kuzzle.hotelClerk.rooms = {
      'foo': {
        customers: [connection.id],
        index,
        collection,
        channels: ['foobar']
      },
      'bar': {
        customers: [connection.id],
        index,
        collection,
        channels: ['barfoo']
      }
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should do nothing when a bad connectionId is given', () => {
    return should(kuzzle.hotelClerk.removeCustomerFromAllRooms({id: 'unknown'})).be.fulfilledWith(undefined);
  });

  it('should clean up customers, rooms object', () => {
    sandbox.stub(kuzzle.dsl, 'remove').returns(Promise.resolve());

    return kuzzle.hotelClerk.removeCustomerFromAllRooms(connection)
      .then(() => {
        should(kuzzle.dsl.remove).be.calledTwice();
        should(kuzzle.notifier.notify.called).be.false();

        should(kuzzle.hotelClerk.rooms).be.an.Object();
        should(kuzzle.hotelClerk.rooms).be.empty();

        should(kuzzle.hotelClerk.customers).be.an.Object();
        should(kuzzle.hotelClerk.customers).be.empty();

        return Promise.resolve();
      });
  });

  it('should send a notification to other users connected on that room', () => {
    var
      mockDsl = sandbox.mock(kuzzle.dsl).expects('remove').once().returns(Promise.resolve());

    kuzzle.hotelClerk.rooms.foo.customers.push('another connection');

    return kuzzle.hotelClerk.removeCustomerFromAllRooms(connection)
      .finally(() => {
        try {
          mockDsl.verify();

          should(kuzzle.notifier.notify)
            .be.calledOnce()
            .be.calledWith(['foo']);

          // testing roomId argument
          should(kuzzle.notifier.notify.args[0][0]).match(['foo']);

          // testing requestObject argument
          should(kuzzle.notifier.notify.args[0][1]).be.instanceOf(RequestObject);
          should(kuzzle.notifier.notify.args[0][1].controller).be.exactly('subscribe');
          should(kuzzle.notifier.notify.args[0][1].action).be.exactly('off');
          should(kuzzle.notifier.notify.args[0][1].index).be.exactly(index);

          // testing payload argument
          should(kuzzle.notifier.notify.args[0][2].count).be.exactly(1);

          return Promise.resolve();
        }
        catch (error) {
          return Promise.reject(error);
        }
      });
  });

  it('should log an error if a problem occurs while unsubscribing', function () {
    var error = new Error('Mocked error');
    this.timeout(500);
    sandbox.stub(kuzzle.dsl, 'remove').returns(Promise.reject(error));

    return should(kuzzle.hotelClerk.removeCustomerFromAllRooms(connection)).be.rejectedWith(error);
  });
});
