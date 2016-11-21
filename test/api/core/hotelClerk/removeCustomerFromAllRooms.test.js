var
  should = require('should'),
  Promise = require('bluebird'),
  sinon = require('sinon'),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  Kuzzle = require.main.require('lib/api/kuzzle');

describe('Test: hotelClerk.removeCustomerFromAllRooms', () => {
  var
    kuzzle,
    connection = {id: 'connectionid'},
    collection = 'user',
    index = '%test',
    sandbox;

  before(() => {
    kuzzle = new Kuzzle();
  });

  beforeEach(() => {
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

    sandbox.stub(kuzzle.internalEngine, 'get').returns(Promise.resolve({}));
    return kuzzle.services.init({whitelist: []});
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should do nothing when a bad connectionId is given', () => {
    return should(kuzzle.hotelClerk.removeCustomerFromAllRooms({id: 'unknown'})).be.fulfilledWith(undefined);
  });

  it('should clean up customers, rooms object', () => {
    var mock = sandbox.mock(kuzzle.dsl).expects('remove').twice().returns(Promise.resolve());

    sandbox.spy(kuzzle.notifier, 'notify');

    return kuzzle.hotelClerk.removeCustomerFromAllRooms(connection)
      .finally(() => {
        try {
          mock.verify();
          should(kuzzle.notifier.notify.called).be.false();

          should(kuzzle.hotelClerk.rooms).be.an.Object();
          should(kuzzle.hotelClerk.rooms).be.empty();

          should(kuzzle.hotelClerk.customers).be.an.Object();
          should(kuzzle.hotelClerk.customers).be.empty();

          return Promise.resolve();
        }
        catch (error) {
          return Promise.reject(error);
        }
      });
  });

  it('should send a notification to other users connected on that room', () => {
    var
      mockDsl = sandbox.mock(kuzzle.dsl).expects('remove').once().returns(Promise.resolve()),
      mockNotify = sandbox.mock(kuzzle.notifier).expects('notify').once();

    kuzzle.hotelClerk.rooms.foo.customers.push('another connection');

    return kuzzle.hotelClerk.removeCustomerFromAllRooms(connection)
      .finally(() => {
        try {
          mockDsl.verify();
          mockNotify.verify();

          // testing roomId argument
          should(mockNotify.args[0][0]).match(['foo']);

          // testing requestObject argument
          should(mockNotify.args[0][1]).be.instanceOf(RequestObject);
          should(mockNotify.args[0][1].controller).be.exactly('subscribe');
          should(mockNotify.args[0][1].action).be.exactly('off');
          should(mockNotify.args[0][1].index).be.exactly(index);

          // testing payload argument
          should(mockNotify.args[0][2].count).be.exactly(1);

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
