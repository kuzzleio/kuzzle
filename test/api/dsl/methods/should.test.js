var
  should = require('should'),
  methods = require.main.require('lib/api/dsl/methods');

require('should-promised');

describe('Test: dsl.should method', function () {

  it('should call the function "AND" in case of a should-not filter', function () {
    var andIsCalled = false;
    methods.and = function () {
      andIsCalled = true;
    };

    methods.should('roomId', {}, {}, true);
    should(andIsCalled).be.exactly(true);
  });

  it('should call the function "OR" in case of a should filter', function () {
    var orIsCalled = false;
    methods.or = function () {
      orIsCalled = true;
    };

    methods.should('roomId', {}, {}, false);
    should(orIsCalled).be.exactly(true);
  });
});
