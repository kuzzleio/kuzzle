var
  should = require('should'),
  q = require('q'),
  rewire = require('rewire'),
  NotFoundError = require.main.require('kuzzle-common-objects').Errors.notFoundError,
  Dsl = rewire('../../../../lib/api/dsl/index');

describe('Test: dsl.test', function () {
  var
    dsl,
    filterId = 'foobar',
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
    };

  beforeEach(() => {
    /** @type Dsl */
    dsl = new Dsl();
    return dsl.register(filterId, index, collection, filterGrace);
  });

  it('should return an array with my filter id when document matches', function () {
    return dsl.test(index, collection, dataGrace)
      .then(filters => {
        should(filters).be.an.Array();
        should(filters).have.length(1);
        should(filters[0]).be.exactly(filterId);
      });
  });

  it('should return empty array when document doesn\'t match', function () {
    return dsl.test('fakeIndex', 'fakeCollection', {})
      .then(function (filters) {
        should(filters).be.an.Array();
        should(filters).be.empty();
      });
  });

  it('should return an error if no index is provided', function () {
    return should(dsl.test(null, collection, dataGrace)).be.rejectedWith(NotFoundError);
  });

  it('should return an error if no collection is provided', function () {
    return should(dsl.test(index, null, dataGrace)).be.rejectedWith(NotFoundError);
  });

  it('should reject the promise if testFieldFilter fails', () => {
    dsl.filters.testFieldFilters = () => q.reject(new Error('rejected'));

    return should(dsl.test(index, collection, dataGrace)).be.rejectedWith('rejected');
  });

  it('should reject the promise if testGlobalsFilter fails', () => {
    dsl.filters.testGlobalsFilters = () => q.reject(new Error('rejected'));
    return should(dsl.test(index, collection, dataGrace)).be.rejectedWith('rejected');
  });
});
