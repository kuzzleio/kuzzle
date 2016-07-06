var
  should = require('should'),
  rewire = require('rewire'),
  q = require('q'),
  Methods = rewire('../../../../lib/api/dsl/methods');

describe('Test: dsl.must method', function () {
  var methods;

  before(function () {
    Methods.__set__('getFormattedFilters', function (roomId) {
      if (roomId === 'resolve') {
        return q({filter: 'resolved'});
      }

      return q.reject(new Error('rejected'));
    });

    methods = new Methods({filtersTree: {}});
  });

  it('should return an embedded object containing the result of getFormattedFilters', function () {
    return should(methods.must('resolve', 'index', {}, {}, false)).be.fulfilledWith({ diff: undefined, filter: {and: 'resolved'} });
  });

  it('should return a rejected promise if getFormattedFilters fails', function () {
    return should(methods.must('rejected', 'index', {}, {}, false)).be.rejectedWith('rejected');
  });
});
