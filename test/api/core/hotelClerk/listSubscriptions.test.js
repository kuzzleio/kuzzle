const
  should = require('should'),
  Bluebird = require('bluebird'),
  sinon = require('sinon'),
  sandbox = sinon.sandbox.create(),
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
    kuzzle.dsl.storage = {
      filtersIndex: {}
    };
    hotelClerk = new HotelClerk(kuzzle);
    context = {
      connectionId,
      token: {
        userId: 'user'
      }
    };
    request = new Request({}, context);
  });

  afterEach(() => {
    sandbox.restore();
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
      isActionAllowed: sandbox.stub().returns(Bluebird.resolve(true))
    };

    kuzzle.dsl.storage.filtersIndex = {
      index: {
        collection: [
          'foo',
          'bar'
        ]
      },
      anotherIndex: {
        anotherCollection: ['baz']
      }
    };
    hotelClerk.rooms = {
      foo: {
        index,
        collection,
        customers: new Set(['a', 'b', 'c'])
      },
      bar: {
        index,
        collection,
        customers: new Set(['a', 'd'])
      },
      baz: {
        index: 'anotherIndex',
        collection: 'anotherCollection',
        customers: new Set(['a', 'c'])
      }
    };

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
    kuzzle.dsl.storage.filtersIndex = {
      index: {
        collection: ['foo', 'bar'],
        forbidden: ['foo']
      },
      anotherIndex: {
        anotherCollection: ['baz']
      },
      andAnotherOne: {
        collection: ['foobar']
      }
    };
    hotelClerk.rooms = {
      foo: {
        customers: new Set(['a', 'b', 'c'])
      },
      bar: {
        customers: new Set(['b', 'd', 'e', 'f'])
      },
      baz: {
        customers: new Set(['d', 'e'])
      },
      foobar: {
        customers: new Set(['a', 'c'])
      }
    };

    request.context.user = {
      _id: 'user',
      isActionAllowed: sandbox.stub().returns(Bluebird.resolve(true))
    };
    request.context.user.isActionAllowed
      .onSecondCall()
      .returns(Bluebird.resolve(false));
    request.context.user.isActionAllowed
      .onThirdCall()
      .returns(Bluebird.resolve(false));

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
