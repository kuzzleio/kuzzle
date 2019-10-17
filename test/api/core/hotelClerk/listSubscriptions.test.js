const
  should = require('should'),
  Bluebird = require('bluebird'),
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
    kuzzle.koncorde.storage = {
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

    kuzzle.koncorde.storage.filtersIndex = {
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
    kuzzle.koncorde.storage.filtersIndex = {
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

  it('should skip non-existing rooms from Koncorde', () => {
    kuzzle.koncorde.storage.filtersIndex = {
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
      foobar: {
        customers: new Set(['a', 'c'])
      }
    };

    let i = 0;
    request.context.user = {
      _id: 'user',
      isActionAllowed: () => Bluebird.delay(0) // <- do not delete the room within the same event loop
        .then(() => {
          i++;
          if (i === 1) {
            delete kuzzle.koncorde.storage.filtersIndex.index.collection;
          }
          if (i === 2) {
            delete kuzzle.koncorde.storage.filtersIndex.anotherIndex;
          }
          return true;
        })
    };

    return hotelClerk.listSubscriptions(request)
      .then(response => {
        should(response)
          .eql({
            andAnotherOne: {
              collection: {
                foobar: 2
              }
            }
          });
      });
  });

});
