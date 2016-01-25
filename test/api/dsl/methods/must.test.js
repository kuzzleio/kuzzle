var
  should = require('should'),
  rewire = require('rewire'),
  q = require('q'),
  methods = rewire('../../../../lib/api/dsl/methods');

describe('Test: dsl.must method', function () {
  before(function () {
    methods.__set__('getFormattedFilters', function (roomId) {
      if (roomId === 'resolve') {
        return q('resolved');
      }
      else {
        return q.reject(new Error('rejected'));
      }
    });
  });

  it('should return an embedded object containing the result of getFormattedFilters', function () {
    return should(methods.must('resolve', 'index', {}, {}, false)).be.fulfilledWith({and: 'resolved'});
  });

  it('should return a rejected promise if getFormattedFilters fails', function () {
    return should(methods.must('rejected', 'index', {}, {}, false)).be.rejectedWith('rejected');
  });
});
