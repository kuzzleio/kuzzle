var
  should = require('should'),
  rewire = require('rewire'),
  methods = rewire('../../../../lib/api/dsl/methods');

require('should-promised');

describe('Test: dsl.must method', function () {
  before(function () {
    methods.__set__('getFormattedFilters', function (roomId) {
      if (roomId === 'resolve') {
        return Promise.resolve('resolved');
      }
      else {
        return Promise.reject(new Error('rejected'));
      }
    });
  });

  it('should return an embedded object containing the result of getFormattedFilters', function () {
    return should(methods.must('resolve', {}, {}, false)).be.fulfilledWith({and: 'resolved'});
  });

  it('should return a rejected promise if getFormattedFilters fails', function () {
    return should(methods.must('rejected', {}, {}, false)).be.rejectedWith('rejected');
  });
});
