var
  should = require('should'),
  q = require('q'),
  sinon = require('sinon'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle');

require('sinon-as-promised')(q.Promise);

describe('Test: hotelClerk.removeCustomerFromAllRooms', function () {
  var
    kuzzle,
    connection = {id: 'connectionid'},
    collection = 'user',
    index = '%test',
    sandbox;

  before(() => {
    kuzzle = new Kuzzle();

    return kuzzle.start(params, {dummy: true});
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
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should do nothing when a bad connectionId is given', function () {
    return should(kuzzle.hotelClerk.removeCustomerFromAllRooms({id: 'unknown'})).be.rejected();
  });

  it('should clean up customers, rooms and filtersTree object', function () {
    var mock = sandbox.mock(kuzzle.dsl).expects('removeRoom').twice().resolves();

    sandbox.spy(kuzzle.notifier, 'notify');

    return kuzzle.hotelClerk.removeCustomerFromAllRooms(connection)
      .finally(function () {
        mock.verify();
        should(kuzzle.notifier.notify.called).be.false();

        should(kuzzle.hotelClerk.rooms).be.an.Object();
        should(kuzzle.hotelClerk.rooms).be.empty();

        should(kuzzle.hotelClerk.customers).be.an.Object();
        should(kuzzle.hotelClerk.customers).be.empty();
      });
  });

  it('should send a notification to other users connected on that room', function () {
    var
      mockDsl = sandbox.mock(kuzzle.dsl).expects('removeRoom').once().resolves(),
      mockNotify = sandbox.mock(kuzzle.notifier).expects('notify').once();

    kuzzle.hotelClerk.rooms.foo.customers.push('another connection');

    return kuzzle.hotelClerk.removeCustomerFromAllRooms(connection)
      .finally(() => {
        mockDsl.verify();
        mockNotify.verify();

        // testing roomId argument
        should(mockNotify.args[0][0]).be.exactly('foo');

        // testing requestObject argument
        should(mockNotify.args[0][1]).be.instanceOf(RequestObject);
        should(mockNotify.args[0][1].controller).be.exactly('subscribe');
        should(mockNotify.args[0][1].action).be.exactly('off');
        should(mockNotify.args[0][1].index).be.exactly(index);

        // testing payload argument
        should(mockNotify.args[0][2].count).be.exactly(1);
      });
  });

  it('should log an error if a problem occurs while unsubscribing', function (done) {
    this.timeout(500);
    sandbox.stub(kuzzle.dsl, 'removeRoom').rejects();

    kuzzle.once('log:error', () => done());

    kuzzle.hotelClerk.removeCustomerFromAllRooms(connection);
  });
});
