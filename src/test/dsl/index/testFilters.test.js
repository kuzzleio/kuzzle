var
  should = require('should'),
  start = require('root-require')('lib/api/start');

describe('Test testFilters function index.js file from DSL', function () {

  var
    kuzzle,
    roomId,
    roomName = 'roomNameGrace',
    collection = 'user',
    dataGrace = {
      collection: collection,
      content: {
        firstName: 'Grace',
        lastName: 'Hopper',
        age: 85,
        location: {
          lat: 32.692742,
          lon: -97.114127
        },
        city: 'NYC',
        hobby: 'computer'
      }
    },
    dataAda = {
      collection: collection,
      content: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        age: 36,
        location: {
          lat: 51.519291,
          lon: -0.149817
        },
        city: 'London',
        hobby: 'computer'
      }
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
    };


  before(function (done) {
    kuzzle = {
      log: {
        debug: function() {},
        silly: function() {},
        error: function() {}
      },
      start: start
    };

    kuzzle.start({}, {workers: false, servers: false});

    kuzzle.hotelClerk.addSubscription({id: 'connectionid'}, roomName, collection, filterGrace)
      .then(function (result) {
        roomId = result.data;
        done();
      });
  });

  it('should return an array with my room id when document matches', function () {
    return kuzzle.dsl.testFilters(dataGrace)
      .then(function (rooms) {
        should(rooms).be.an.Array;
        should(rooms).have.length(1);
        should(rooms[0]).be.exactly(roomId);
      });
  });

  it('should return empty array when document doesn\'t match', function () {
    return kuzzle.dsl.testFilters(dataAda)
      .then(function (rooms) {
        should(rooms).be.an.Array;
        should(rooms).be.empty;
      });
  });


});