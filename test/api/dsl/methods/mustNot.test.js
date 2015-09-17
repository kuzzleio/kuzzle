var
  should = require('should'),
  rewire = require('rewire'),
  methods = rewire('../../../../lib/api/dsl/methods');

require('should-promised');

describe('Test: dsl.mustNot method', function () {
  before(function () {
    methods.must = function (roomId, collection, filters, not) {
      should(roomId).be.exactly(not);
    };
  });

  it('should pass an inverted "not" argument to the must function', function () {
    methods.mustNot(true, {}, {}, false);
    methods.mustNot(false, {}, {}, true);
  });

  it('should default default the "not" argument to true', function () {
    methods.mustNot(true, {}, {});
  });
});
