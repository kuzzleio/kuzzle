const
  should = require('should'),
  sinon = require('sinon'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  HotelClerk = require('../../../../lib/api/core/hotelClerk'),
  Request = require('kuzzle-common-objects').Request;

describe('Test: hotelClerk.listSubscription', () => {
  let
    kuzzle,
    connectionId = 'connectionid',
    context,
    request,
    index = '%test',
    collection = 'user',
    hotelClerk;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    hotelClerk = new HotelClerk(kuzzle);
    context = {
      connectionId,
      token: {
        userId: 'user'
      }
    };
    request = new Request({}, context);
  });

  it('should return an empty object if there is no room', () => {
    return hotelClerk.listSubscriptions(request)
      .then(response => {
        should(response).be.empty().Object();
      });
  });

  it('should return a correct list according to subscribe on filter', () => {
    request.context.user = {
      _id: 'user',
      isActionAllowed: sinon.stub().resolves(true)
    };

    kuzzle.realtime.getIndexes.returns(['index', 'anotherIndex']);
    kuzzle.realtime.getCollections.withArgs('index').returns(['collection']);
    kuzzle.realtime.getCollections
      .withArgs('anotherIndex')
      .returns(['anotherCollection']);
    kuzzle.realtime.getFilterIds
      .withArgs('index', 'collection')
      .returns(['foo', 'bar']);
    kuzzle.realtime.getFilterIds
      .withArgs('anotherIndex', 'anotherCollection')
      .returns(['baz']);

    hotelClerk.rooms.set('foo', {
      index,
      collection,
      customers: new Set(['a', 'b', 'c'])
    });
    hotelClerk.rooms.set('bar', {
      index,
      collection,
      customers: new Set(['a', 'd'])
    });
    hotelClerk.rooms.set('baz', {
      index: 'anotherIndex',
      collection: 'anotherCollection',
      customers: new Set(['a', 'c'])
    });

    return hotelClerk.listSubscriptions(request)
      .then(response => {
        should(response)
          .match({
            index: {
              collection: {
                foo: 3,
                bar: 2
              }
            },
            anotherIndex: {
              anotherCollection: {
                baz: 2
              }
            }
          });
      });
  });

  it('should return a correct list according to subscribe on filter and user right', () => {
    kuzzle.realtime.getIndexes
      .returns(['index', 'anotherIndex', 'andAnotherOne']);
    kuzzle.realtime.getCollections
      .withArgs('index')
      .returns(['collection', 'forbidden']);
    kuzzle.realtime.getCollections
      .withArgs('anotherIndex')
      .returns(['anotherCollection']);
    kuzzle.realtime.getCollections
      .withArgs('andAnotherOne')
      .returns(['collection']);
    kuzzle.realtime.getFilterIds
      .withArgs('index', 'collection')
      .returns(['foo', 'bar']);
    kuzzle.realtime.getFilterIds
      .withArgs('index', 'forbidden')
      .returns(['foo']);
    kuzzle.realtime.getFilterIds
      .withArgs('anotherIndex', 'anotherCollection')
      .returns(['baz']);
    kuzzle.realtime.getFilterIds
      .withArgs('andAnotherOne', 'collection')
      .returns(['foobar']);

    hotelClerk.rooms.set('foo', { customers: new Set(['a', 'b', 'c']) });
    hotelClerk.rooms.set('bar', { customers: new Set(['b', 'd', 'e', 'f']) });
    hotelClerk.rooms.set('baz', { customers: new Set(['d', 'e']) });
    hotelClerk.rooms.set('foobar', { customers: new Set(['a', 'c']) });

    request.context.user = {
      _id: 'user',
      isActionAllowed: sinon.stub().resolves(true)
    };
    request.context.user.isActionAllowed
      .onSecondCall()
      .resolves(false);
    request.context.user.isActionAllowed
      .onThirdCall()
      .resolves(false);

    return hotelClerk.listSubscriptions(request)
      .then(response => {
        should(response)
          .match({
            index: {
              collection: {
                foo: 3,
                bar: 4
              }
            },
            andAnotherOne: {
              collection: {
                foobar: 2
              }
            }
          });
      });

  });

});
