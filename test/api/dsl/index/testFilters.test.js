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
    dataAda = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      age: 36,
      location: {
        lat: 51.519291,
        lon: -0.149817
      },
      city: 'London',
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
      .then(() => kuzzle.repositories.user.anonymous())
      .then(user => {
        var context = {
          connection: {id: 'connectionid'},
          user: user
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
    return kuzzle.dsl.testFilters(index, collection, null, dataAda)
      .then(function (rooms) {
        should(rooms).be.an.Array();
        should(rooms).be.empty();
      });
  });

  it('should return an error if no index is provided', function () {
    return should(kuzzle.dsl.testFilters(null, collection, null, dataAda)).be.rejectedWith(NotFoundError);
  });

  it('should return an error if the requestObject doesn\'t contain a collection name', function () {
    return should(kuzzle.dsl.testFilters(index, null, null, dataAda)).be.rejectedWith(NotFoundError);
  });

  it('should generate an event if filter tests on fields fail', function (done) {
    this.timeout(50);

    kuzzle.once('filter:error', function (error) {
      try {
        should(error.message).be.exactly('rejected');
        done();
      }
      catch (e) {
        done(e);
      }
    });

    Dsl.__with__({
      testFieldFilters: function () { return q.reject(new Error('rejected')); }
    })(function () {
      var dsl = new Dsl(kuzzle);
      dsl.filtersTree[index] = {};
      dsl.filtersTree[index][collection] = {};
      dsl.testFilters(index, collection, null, dataGrace);
    });
  });

  it('should generate an event if global filter tests fail', function (done) {
    this.timeout(50);

    kuzzle.once('filter:error', function (error) {
      try {
        should(error.message).be.exactly('rejected');
        done();
      }
      catch (e) {
        done(e);
      }
    });

    Dsl.__with__({
      testGlobalsFilters: function () { return q.reject(new Error('rejected')); }
    })(function () {
      var dsl = new Dsl(kuzzle);
      dsl.filtersTree[index] = {};
      dsl.filtersTree[index][collection] = {};
      dsl.testFilters(index, collection, null, dataGrace);
    });
  });
});
