var
  should = require('should'),
  Promise = require('bluebird'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
  RequestObject = require.main.require('kuzzle-common-objects').Models.requestObject,
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError,
  NotFoundError = require.main.require('kuzzle-common-objects').Errors.notFoundError,
  Dsl = require('../../../../lib/api/dsl'),
  HotelClerk = require('../../../../lib/api/core/hotelClerk'),
  Kuzzle = require('../../../mocks/kuzzle.mock');

describe('Test: hotelClerk.removeSubscription', () => {
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


  beforeEach(() => {
    kuzzle = new Kuzzle();
    kuzzle.hotelClerk = new HotelClerk(kuzzle);
    kuzzle.dsl = new Dsl();

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

  it('should do nothing when a bad connectionId is given', () => {
    var
      badContext = {
        connection: {id: 'unknown'},
        user: null
      };

    return should(kuzzle.hotelClerk.removeSubscription(unsubscribeRequest, badContext)).be.rejectedWith(NotFoundError);
  });

  it('should do nothing when a badly formed unsubscribe request is provided', () => {
    delete unsubscribeRequest.data.body;
    return should(kuzzle.hotelClerk.removeSubscription(unsubscribeRequest, context)).be.rejectedWith(BadRequestError);
  });

  it('should do nothing if a bad room name is given', () => {
    unsubscribeRequest.data.body.roomId = 'qux';
    return should(kuzzle.hotelClerk.removeSubscription(unsubscribeRequest, context)).be.rejectedWith(NotFoundError);
  });

  it('should not delete all subscriptions when we want to just remove one', () => {
    var mock = sandbox.mock(kuzzle.dsl).expects('remove').once().returns(Promise.resolve());

    return kuzzle.hotelClerk.removeSubscription(unsubscribeRequest, context)
      .finally(() => {
        mock.verify();
        should(kuzzle.notifier.notify.called).be.false();

        should(kuzzle.hotelClerk.rooms).be.an.Object();
        should(kuzzle.hotelClerk.rooms).have.property('bar');
        should(kuzzle.hotelClerk.rooms).not.have.property('foo');

        should(kuzzle.hotelClerk.customers).be.an.Object();
        should(kuzzle.hotelClerk.customers).not.be.empty();
      });
  });

  it('should clean up customers, rooms object', () => {
    var mock = sandbox.mock(kuzzle.dsl).expects('remove').once().returns(Promise.resolve());

    delete kuzzle.hotelClerk.rooms.bar;
    delete kuzzle.hotelClerk.customers[connection.id].bar;

    return kuzzle.hotelClerk.removeSubscription(unsubscribeRequest, context)
      .finally(() => {
        mock.verify();
        should(kuzzle.notifier.notify.called).be.false();

        should(kuzzle.hotelClerk.rooms).be.an.Object();
        should(kuzzle.hotelClerk.rooms).be.empty();

        should(kuzzle.hotelClerk.customers).be.an.Object();
        should(kuzzle.hotelClerk.customers).be.empty();
      });
  });

  it('should send a notification to other users connected on that room', () => {
    var
      mockDsl = sandbox.mock(kuzzle.dsl).expects('remove').never();

    kuzzle.hotelClerk.rooms.foo.customers.push('another connection');

    return kuzzle.hotelClerk.removeSubscription(unsubscribeRequest, context)
      .finally(() => {
        mockDsl.verify();

        should(kuzzle.notifier.notify)
          .be.calledOnce();

        // testing roomId argument
        should(kuzzle.notifier.notify.args[0][0]).match(['foo']);

        // testing requestObject argument
        should(kuzzle.notifier.notify.args[0][1]).be.instanceOf(RequestObject);
        should(kuzzle.notifier.notify.args[0][1].controller).be.exactly('subscribe');
        should(kuzzle.notifier.notify.args[0][1].action).be.exactly('off');
        should(kuzzle.notifier.notify.args[0][1].index).be.exactly(index);

        // testing payload argument
        should(kuzzle.notifier.notify.args[0][2].count).be.exactly(1);
      });
  });

  it('should trigger a proxy:leaveChannel hook', function () {
    sandbox.stub(kuzzle.dsl, 'remove').returns(Promise.resolve());

    return kuzzle.hotelClerk.removeSubscription(unsubscribeRequest, context)
      .then(() => {
        var data;

        should(kuzzle.pluginsManager.trigger)
          .be.calledWith('proxy:leaveChannel');

        data = kuzzle.pluginsManager.trigger.secondCall.args[1];

        should(data).be.an.Object();
        should(data.channel).be.a.String();
        should(data.id).be.eql(context.connection.id);
      });
  });
});
