var
  should = require('should'),

  captainLog = require('captains-log'),
  start = require('root-require')('lib/api/start')({}, {workers: false, server: false}),
  HotelClerkController = require('root-require')('lib/api/controllers/hotelClerkController');
  index = require('root-require')('lib/api/dsl/index'),

describe('Test testFilters function index.js file from DSL', function () {

  var
    hotelClerk,
    requestId = 'roomNameGrace',
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
        must_not: [
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
    var kuzzle = {
      log: captainLog(),
      start: start
    };

    hotelClerk = new HotelClerkController(kuzzle);
  });

  it('should construct the filterTree object for the correct attribute', function () {

  });


});