var
  should = require('should'),
  rewire = require('rewire'),
  NotFoundError = require.main.require('kuzzle-common-objects').Errors.notFoundError,
  Dsl = rewire('../../../../lib/api/dsl/index');

describe('Test: dsl.test', () => {
  var
    dsl,
    filterId,
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
            in: {
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
                equals: {
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

  beforeEach(() => {
    /** @type Dsl */
    dsl = new Dsl();
    return dsl.register(index, collection, filterGrace)
      .then(response => {
        filterId = response.id;
      });
  });

  it('should return an array with my filter id when document matches', () => {
    return dsl.test(index, collection, dataGrace)
      .then(filters => {
        should(filters).be.an.Array();
        should(filters).have.length(1);
        should(filters[0]).be.exactly(filterId);
      });
  });

  it('should return empty array when document doesn\'t match', () => {
    return dsl.test('fakeIndex', 'fakeCollection', {})
      .then(filters => {
        should(filters).be.an.Array();
        should(filters).be.empty();
      });
  });

  it('should return an error if no index is provided', () => {
    return should(dsl.test(null, collection, dataGrace)).be.rejectedWith(NotFoundError);
  });

  it('should return an error if no collection is provided', () => {
    return should(dsl.test(index, null, dataGrace)).be.rejectedWith(NotFoundError);
  });
});
