var
  should = require('should'),
  rewire = require('rewire'),
  Promise = require('bluebird'),
  Methods = rewire('../../../../lib/api/dsl/methods');

describe('Test: dsl.should method', () => {
  var methods;

  before(() => {
    should.noConflict();

    Methods.__set__('getFormattedFilters', function (roomId) {
      if (roomId === 'resolve') {
        return Promise.resolve('resolved');
      }

      return Promise.reject(new Error('rejected'));
    });

    methods = new Methods({filtersTree: {}});
  });

  it('should call the function "AND" in case of a should-not filter', () => {
    var andIsCalled = false;
    methods.and = () => {
      andIsCalled = true;
    };

    methods.should('roomId', 'index', {}, {}, true);
    should(andIsCalled).be.exactly(true);
  });

  it('should call the function "OR" in case of a should filter', () => {
    var orIsCalled = false;
    methods.or = () => {
      orIsCalled = true;
    };

    methods.should('roomId', 'index', {}, {}, false);
    should(orIsCalled).be.exactly(true);
  });
});
