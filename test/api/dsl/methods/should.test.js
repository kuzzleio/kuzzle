var
  should = require('should'),
  rewire = require('rewire'),
  q = require('q'),
  Methods = rewire('../../../../lib/api/dsl/methods');

describe('Test: dsl.should method', function () {
  var methods;

  before(function () {
    should.noConflict();

    Methods.__set__('getFormattedFilters', function (roomId) {
      if (roomId === 'resolve') {
        return q('resolved');
      }

      return q.reject(new Error('rejected'));
    });

    methods = new Methods({filtersTree: {}});
  });

  it('should call the function "AND" in case of a should-not filter', function () {
    var andIsCalled = false;
    methods.and = function () {
      andIsCalled = true;
    };

    methods.should('roomId', 'index', {}, {}, true);
    should(andIsCalled).be.exactly(true);
  });

  it('should call the function "OR" in case of a should filter', function () {
    var orIsCalled = false;
    methods.or = function () {
      orIsCalled = true;
    };

    methods.should('roomId', 'index', {}, {}, false);
    should(orIsCalled).be.exactly(true);
  });
});
