// Allow the "import ... from" ES6 syntax used in the DSL
require('reify');

const
  should = require('should'),
  sinon = require('sinon'),
  Request = require('kuzzle-common-objects').Request,
  NotFoundError = require('kuzzle-common-objects').errors.NotFoundError,
  HotelClerk = require('../../../../lib/api/core/hotelClerk'),
  KuzzleMock = require('../../../mocks/kuzzle.mock');

describe('Test: hotelClerk.removeSubscription', () => {
  let
    kuzzle,
    hotelClerk,
    connectionId = 'connectionid',
    context = {
      connectionId,
      user: null
    },
    index = 'test',
    collection = 'user',
    unsubscribeRequest;


  beforeEach(() => {
    kuzzle = new KuzzleMock();
    hotelClerk = new HotelClerk(kuzzle);

    unsubscribeRequest = new Request({
      controller: 'realtime',
      action: 'unsubscribe',
      index: index,
      collection: collection,
      body: { roomId: 'foo' }
    }, context);

    hotelClerk.customers[connectionId] = {
      'foo': {},
      'bar': {}
    };

    hotelClerk.rooms = {
      'foo': {
        customers: new Set([connectionId]),
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

  it('should throw if a bad room name is given', () => {
    unsubscribeRequest.input.body.roomId = 'qux';
    return should(() => hotelClerk.removeSubscription(unsubscribeRequest))
      .throw(NotFoundError);
  });

  it('should not delete all subscriptions when we want to just remove one', () => {
    const response = hotelClerk.removeSubscription(unsubscribeRequest, context);
    
    should(response).be.exactly(unsubscribeRequest.input.body.roomId);

    should(kuzzle.dsl.remove).be.calledOnce();

    should(kuzzle.notifier.notifyUser.called).be.false();

    should(hotelClerk.roomsCount).be.eql(1);

    should(hotelClerk.rooms).be.an.Object();
    should(hotelClerk.rooms).have.property('bar');
    should(hotelClerk.rooms).not.have.property('foo');

    should(hotelClerk.customers).be.an.Object();
    should(hotelClerk.customers).not.be.empty();
  });

  it('should clean up customers, rooms object', () => {
    delete hotelClerk.rooms.bar;
    delete hotelClerk.customers[connectionId].bar;
    hotelClerk.roomsCount = 1;

    const response = hotelClerk.removeSubscription(unsubscribeRequest, context);
    should(response)
      .be.exactly(unsubscribeRequest.input.body.roomId);

    should(kuzzle.dsl.remove)
      .be.calledOnce()
      .be.calledWith(unsubscribeRequest.input.body.roomId);

    should(kuzzle.notifier.notifyUser.called).be.false();

    should(hotelClerk.rooms).be.an.Object().and.be.empty();
    should(hotelClerk.customers).be.an.Object().and.be.empty();
    should(hotelClerk.roomsCount).be.eql(0);
  });

  it('should send a notification to other users connected on that room', () => {
    kuzzle.dsl.remove = sinon.spy();

    hotelClerk.rooms.foo.customers.add('another connection');
    hotelClerk.removeSubscription(unsubscribeRequest, context);

    should(kuzzle.dsl.remove.called).be.false();
    should(kuzzle.notifier.notifyUser).be.calledOnce();
    should(hotelClerk.roomsCount).be.eql(2);

    // testing roomId argument
    should(kuzzle.notifier.notifyUser.args[0][0]).be.eql('foo');

    // testing request argument
    should(kuzzle.notifier.notifyUser.args[0][1]).be.instanceOf(Request);
    should(kuzzle.notifier.notifyUser.args[0][1].input.controller).be.exactly('realtime');
    should(kuzzle.notifier.notifyUser.args[0][1].input.action).be.exactly('unsubscribe');
    should(kuzzle.notifier.notifyUser.args[0][1].input.resource.index).be.exactly(index);


    // testing scope argument
    should(kuzzle.notifier.notifyUser.args[0][2]).be.eql('out');

    // testing payload argument
    should(kuzzle.notifier.notifyUser.args[0][3].count).be.exactly(1);
  });
});
