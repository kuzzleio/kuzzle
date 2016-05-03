var
  should = require('should'),
  q = require('q'),
  rewire = require('rewire'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  NotFoundError = require.main.require('lib/api/core/errors/notFoundError'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  Dsl = rewire('../../../../lib/api/dsl/index');

describe('Test: dsl.testFilters', function () {
  var
    kuzzle,
    roomId,
    roomName = 'roomNameGrace',
    index = 'index',
    collection = 'user',
    dataGrace = {
      firstName: 'Grace',
      lastName: 'Hopper',
      age: 85,
      location: {
        lat: 32.692742,
        lon: -97.114127
      },
      city: 'NYC',
      hobby: 'computer'
    },
    filterGrace = {
      bool: {
        must: [
          {
            terms: {
              city: ['NYC', 'London']
            }
          },
          {
            and: [
              {
                range: {
                  age: {
                    gt: 30,
                    lte: 85
                  }
                }
              },
              {
                term: {
                  hobby: 'computer'
                }
              }
            ]
          }
        ],
        'must_not': [
          {
            'geo_bounding_box': {
              // england
              location: {
                top: -2.939744,
                left: 52.394484,
                bottom: 1.180129,
                right: 51.143628
              }
            }
          }
        ]
      }
    },
    requestObjectSubscribeGrace = new RequestObject({
      requestId: roomName,
      index: index,
      collection: collection,
      body: filterGrace
    });

  before(() => {
    kuzzle = new Kuzzle();

    return kuzzle.start(params, {dummy: true})
      .then(user => {
        var context = {
          connection: {id: 'connectionid'},
          user: null
        };

        return kuzzle.hotelClerk.addSubscription(requestObjectSubscribeGrace, context);
      })
      .then(notificationObject => {
        roomId = notificationObject.roomId;
      });
  });

  it('should return an array with my room id when document matches', function () {
    return kuzzle.dsl.testFilters(index, collection, null, dataGrace)
      .then(rooms => {
        should(rooms).be.an.Array();
        should(rooms).have.length(1);
        should(rooms[0]).be.exactly(roomId);
      });
  });

  it('should return empty array when document doesn\'t match', function () {
    return kuzzle.dsl.testFilters('fakeIndex', 'fakeCollection', null, {})
      .then(function (rooms) {
        should(rooms).be.an.Array();
        should(rooms).be.empty();
      });
  });

  it('should return an error if no index is provided', function () {
    return should(kuzzle.dsl.testFilters(null, collection, null, dataGrace)).be.rejectedWith(NotFoundError);
  });

  it('should return an error if the requestObject doesn\'t contain a collection name', function () {
    return should(kuzzle.dsl.testFilters(index, null, null, dataGrace)).be.rejectedWith(NotFoundError);
  });

  it('should reject the promise if testFieldFilter fails', (done) => {
    Dsl.__with__({
        testFieldFilters: function () { return q.reject(new Error('rejected')); }
    })(function () {
      var dsl = new Dsl(kuzzle);
      dsl.filtersTree[index] = {};
      dsl.filtersTree[index][collection] = {};
      dsl.testFilters(index, collection, null, dataGrace)
        .then(() => done('Test should have failed'))
        .catch(() => done());
    });
  });

  it('should reject the promise if testFieldFilter fails', (done) => {
    Dsl.__with__({
      testGlobalsFilters: function () { return q.reject(new Error('rejected')); }
    })(function () {
      var dsl = new Dsl(kuzzle);
      dsl.filtersTree[index] = {};
      dsl.filtersTree[index][collection] = {};
      dsl.testFilters(index, collection, null, dataGrace)
        .then(() => done('Test should have failed'))
        .catch(() => done());
    });
  });
});
