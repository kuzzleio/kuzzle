var
  should = require('should'),
  q = require('q'),
  sinon = require('sinon'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  BadRequestError = require.main.require('lib/api/core/errors/badRequestError'),
  NotFoundError = require.main.require('lib/api/core/errors/notFoundError'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle');

require('sinon-as-promised')(q.Promise);

describe('Test: hotelClerk.removeSubscription', function () {
  var
    kuzzle,
    connection = {id: 'connectionid'},
    context = {
      connection: connection,
      user: null
    },
    index = 'test',
    collection = 'user',
    unsubscribeRequest;


  before(() => {
    kuzzle = new Kuzzle();

    return kuzzle.start(params, {dummy: true});
  });

  beforeEach(() => {
    sandbox = sinon.sandbox.create();

    unsubscribeRequest = new RequestObject({
      controller: 'subscribe',
      action: 'off',
      index: index,
      collection: collection,
      body: { roomId: 'foo' }
    });

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
    var
      badContext = {
        connection: {id: 'unknown'},
        user: null
      };

    return should(kuzzle.hotelClerk.removeSubscription(unsubscribeRequest, badContext)).be.rejectedWith(NotFoundError);
  });

  it('should do nothing when a badly formed unsubscribe request is provided', function () {
    delete unsubscribeRequest.data.body;
    return should(kuzzle.hotelClerk.removeSubscription(unsubscribeRequest, context)).be.rejectedWith(BadRequestError);
  });

  it('should do nothing if a bad room name is given', function () {
    unsubscribeRequest.data.body.roomId = 'qux';
    return should(kuzzle.hotelClerk.removeSubscription(unsubscribeRequest, context)).be.rejectedWith(NotFoundError);
  });

  it('should not delete all subscriptions when we want to just remove one', function () {
    var mock = sandbox.mock(kuzzle.dsl).expects('removeRoom').once().resolves();

    sandbox.spy(kuzzle.notifier, 'notify');

    return kuzzle.hotelClerk.removeSubscription(unsubscribeRequest, context)
      .finally(function () {
        mock.verify();
        should(kuzzle.notifier.notify.called).be.false();

        should(kuzzle.hotelClerk.rooms).be.an.Object();
        should(kuzzle.hotelClerk.rooms).have.property('bar');
        should(kuzzle.hotelClerk.rooms).not.have.property('foo');

        should(kuzzle.hotelClerk.customers).be.an.Object();
        should(kuzzle.hotelClerk.customers).not.be.empty();
      });
  });

  it('should clean up customers, rooms and filtersTree object', function () {
    var mock = sandbox.mock(kuzzle.dsl).expects('removeRoom').once().resolves();

    sandbox.spy(kuzzle.notifier, 'notify');
    delete kuzzle.hotelClerk.rooms.bar;
    delete kuzzle.hotelClerk.customers[connection.id].bar;

    return kuzzle.hotelClerk.removeSubscription(unsubscribeRequest, context)
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
      mockDsl = sandbox.mock(kuzzle.dsl).expects('removeRoom').never(),
      mockNotify = sandbox.mock(kuzzle.notifier).expects('notify').once();

    kuzzle.hotelClerk.rooms.foo.customers.push('another connection');

    return kuzzle.hotelClerk.removeSubscription(unsubscribeRequest, context)
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

  it('should trigger a protocol:leaveChannel hook', function (done) {
    this.timeout(50);

    kuzzle.once('protocol:leaveChannel', (data) => {
      should(data).be.an.Object();
      should(data.channel).be.a.String();
      should(data.id).be.eql(context.connection.id);
      done();
    });

    kuzzle.hotelClerk.removeSubscription(unsubscribeRequest, context);
  });
});
