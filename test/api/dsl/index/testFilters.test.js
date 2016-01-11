var
  should = require('should'),
  rewire = require('rewire'),
  RequestObject = require.main.require('lib/api/core/models/requestObject'),
  params = require('rc')('kuzzle'),
  Kuzzle = require.main.require('lib/api/Kuzzle'),
  Dsl = rewire('../../../../lib/api/dsl/index'),
  Profile = require.main.require('lib/api/core/models/security/profile'),
  Role = require.main.require('lib/api/core/models/security/role');

require('should-promised');

describe('Test: dsl.testFilters', function () {
  var
    kuzzle,
    anonymousUser,
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

    requestObjectCreateGrace = new RequestObject({
      requestId: roomName,
      index: index,
      collection: collection,
      body: dataGrace
    }),
    requestObjectSubscribeGrace = new RequestObject({
      requestId: roomName,
      index: index,
      collection: collection,
      body: filterGrace
    }),
    requestObjectCreateAda = new RequestObject({
      requestId: roomName,
      index: index,
      collection: collection,
      body: dataAda
    });


  before(function (done) {
    kuzzle = new Kuzzle();

    kuzzle.start(params, {dummy: true})
      .then(function () {
        kuzzle.repositories.role.roles.guest = new Role();
        return kuzzle.repositories.role.hydrate(kuzzle.repositories.role.roles.guest, params.userRoles.guest);
      })
      .then(function () {
        kuzzle.repositories.profile.profiles.anonymous = new Profile();
        return kuzzle.repositories.profile.hydrate(kuzzle.repositories.profile.profiles.anonymous, params.userProfiles.anonymous);
      })
      .then(function () {
        return kuzzle.repositories.user.anonymous();
      })
      .then(function (user) {
        var context = {
          connection: {id: 'connectionid'},
          user: user
        };

        anonymousUser = user;
        return kuzzle.hotelClerk.addSubscription(requestObjectSubscribeGrace, context);
      })
      .then(function (realTimeResponseObject) {
        roomId = realTimeResponseObject.roomId;
        done();
      });
  });

  it('should return an array with my room id when document matches', function () {
    return kuzzle.dsl.testFilters(requestObjectCreateGrace)
      .then(function (rooms) {
        should(rooms).be.an.Array();
        should(rooms).have.length(1);
        should(rooms[0]).be.exactly(roomId);
      });
  });

  it('should return empty array when document doesn\'t match', function () {
    return kuzzle.dsl.testFilters(requestObjectCreateAda)
      .then(function (rooms) {
        should(rooms).be.an.Array();
        should(rooms).be.empty();
      });
  });

  it('should return an error if the requestObject doesn\'t contain a index name', function () {
    var requestObject = new RequestObject({
      requestId: roomName,
      collection: 'test',
      body: dataGrace
    });

    return should(kuzzle.dsl.testFilters(requestObject)).be.rejected();
  });

  it('should return an error if the requestObject doesn\'t contain a collection name', function () {
    var requestObject = new RequestObject({
      requestId: roomName,
      index: 'test',
      body: dataGrace
    });

    return should(kuzzle.dsl.testFilters(requestObject)).be.rejected();
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
      testFieldFilters: function () { return Promise.reject(new Error('rejected')); }
    })(function () {
      var dsl = new Dsl(kuzzle);
      dsl.filtersTree[requestObjectCreateGrace.index] = {};
      dsl.filtersTree[requestObjectCreateGrace.index][requestObjectCreateGrace.collection] = {};
      dsl.testFilters(requestObjectCreateGrace);
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
      testGlobalsFilters: function () { return Promise.reject(new Error('rejected')); }
    })(function () {
      var dsl = new Dsl(kuzzle);
      dsl.filtersTree[requestObjectCreateGrace.index] = {};
      dsl.filtersTree[requestObjectCreateGrace.index][requestObjectCreateGrace.collection] = {};
      dsl.testFilters(requestObjectCreateGrace);
    });
  });
});
