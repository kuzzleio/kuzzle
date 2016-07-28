var
  should = require('should'),
  rewire = require('rewire'),
  Promise = require('bluebird'),
  Methods = rewire('../../../../lib/api/dsl/methods');

describe('Test: dsl.must method', () => {
  var methods;

  before(() => {
    Methods.__set__('getFormattedFilters', roomId => {
      if (roomId === 'resolve') {
        return Promise.resolve({filter: 'resolved'});
      }

      return Promise.reject(new Error('rejected'));
    });

    methods = new Methods({filtersTree: {}});
  });

  it('should return an embedded object containing the result of getFormattedFilters', () => {
    return should(methods.must('resolve', 'index', {}, {}, false)).be.fulfilledWith({ diff: undefined, filter: {and: 'resolved'} });
  });

  it('should return a rejected promise if getFormattedFilters fails', () => {
    return should(methods.must('rejected', 'index', {}, {}, false)).be.rejectedWith('rejected');
  });
});
