var
  should = require('should'),
  start = require('root-require')('lib/api/start');

describe('Test addSubscription function in hotelClerk controller', function () {

  var
    kuzzle,
    roomId,
    connection = {id: 'connectionid'},
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


  before(function () {
    kuzzle = {
      log: {
        debug: function() {},
        silly: function() {},
        error: function() {}
      },
      start: start
    };

    kuzzle.start({}, {workers: false, servers: false});
  });

  it('should have object filtersTree, customers and rooms empty', function () {
    should(kuzzle.dsl.filtersTree).be.an.object;
    should(kuzzle.dsl.filtersTree).be.empty;

    should(kuzzle.dsl.rooms).be.an.object;
    should(kuzzle.dsl.rooms).be.empty;

    should(kuzzle.dsl.customers).be.an.object;
    should(kuzzle.dsl.customers).be.empty;
  });

  it('should has filtersTree with the right room and filters', function () {
  });

  it('should has rooms object with the right room and filters', function () {
  });

  it('should return an error when the user has already subscribe to the filter', function () {
  });


});