var
  should = require('should'),
  rewire = require('rewire'),
  Methods = rewire('../../../../lib/api/dsl/methods');

describe('Test: dsl.mustNot method', function () {
  var methods;
  
  before(function () {
    methods = new Methods({filtersTree: {}});

    methods.must = function (roomId, index, collection, filters, not) {
      should(roomId).be.exactly(not);
    };
  });

  it('should pass an inverted "not" argument to the must function', function () {
    methods.mustNot(true, 'index', {}, {}, false);
    methods.mustNot(false, 'index', {}, {}, true);
  });

  it('should default default the "not" argument to true', function () {
    methods.mustNot(true, 'index', {}, {});
  });
});
