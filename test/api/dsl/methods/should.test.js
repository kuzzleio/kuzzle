var
  should = require('should'),
  rewire = require('rewire'),
  methods = rewire('../../../../lib/api/dsl/methods');

require('should-promised');

describe('Test: dsl.should method', function () {
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

  it('should return an "AND" embedded object in case of a should-not filter', function () {
    return should(methods.should('resolve', {}, {}, true)).be.fulfilledWith({and: 'resolved'});
  });

  it('should return an "OR" embedded object in case of a should filter', function () {
    return should(methods.should('resolve', {}, {}, false)).be.fulfilledWith({or: 'resolved'});
  });

  it('should return a rejected promise if getFormattedFilters fails', function () {
    return should(methods.should('rejected', {}, {}, false)).be.rejectedWith('rejected');
  });
});
