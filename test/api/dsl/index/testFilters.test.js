var
  should = require('should'),
  captainsLog = require('captains-log'),
  RequestObject = require('root-require')('lib/api/core/models/requestObject'),
  Kuzzle = require('root-require')('lib/api/Kuzzle');

describe('Test testFilters function index.js file from DSL', function () {

  var
    kuzzle,
    roomId,
    roomName = 'roomNameGrace',
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
      collection: collection,
      body: dataGrace
    }),
    requestObjectSubscribeGrace = new RequestObject({
      requestId: roomName,
      collection: collection,
      body: filterGrace
    }),
    requestObjectCreateAda = new RequestObject({
      requestId: roomName,
      collection: collection,
      body: dataAda
    });


  before(function (done) {
    kuzzle = new Kuzzle();
    kuzzle.log = new captainsLog({level: 'silent'});

    kuzzle.start({}, {dummy: true})
      .then(function () {
        return kuzzle.hotelClerk.addSubscription(requestObjectSubscribeGrace, {id: 'connectionid'});
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


});