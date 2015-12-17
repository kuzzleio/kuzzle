var
  should = require('should'),
  rewire = require('rewire'),
  Dsl = rewire('../../../../lib/api/dsl/index');

describe('Test: dsl.testFilterRecursively', function () {
  var
    testFilterRecursively = Dsl.__get__('testFilterRecursively');

  it('should return the result of the filter if no upper operand is provided', function () {
    var
      filter1 = {
        foo: {
          fn: function () {
            return true;
          }
        }
      },
      filter2 = {
        foo: {
          fn: function () {
            return false;
          }
        }
      };

    should(testFilterRecursively({}, filter1, {})).be.true();
    should(testFilterRecursively({}, filter2, {})).be.false();
  });

  it('should do nothing if a wrong upper operand argument is provided', function () {
    var
      filter1 = {
        foo: {
          fn: function () {
            return true;
          }
        }
      },
      filter2 = {
        foo: {
          fn: function () {
            return false;
          }
        }
      };

    should(testFilterRecursively({}, filter1, {}, 'foo')).be.undefined();
    should(testFilterRecursively({}, filter2, {}, 'foo')).be.undefined();
  });

  it('should return the final result of an AND filter set', function () {
    var
      returnedBeforeLastTest = true,
      filters = {
        foo: {
          fn: function () {
            return true;
          }
        },
        bar: {
          fn: function (body) {
            return body.result;
          }
        },
        baz: {
          fn: function () {
            returnedBeforeLastTest = false;
            return true;
          }
        }
      };

    should(testFilterRecursively({ result: false}, filters, {}, 'and')).be.false();
    should(returnedBeforeLastTest).be.true();

    should(testFilterRecursively({ result: true}, filters, {}, 'and')).be.true();
  });

  it('should return the final result of an OR filter set', function () {
    var
      returnedBeforeLastTest = true,
      filters = [
        {
          foo: {
            fn: function () {
              return false;
            }
          }
        },
        {
          bar: {
            fn: function (body) {
              return body.result;
            }
          }
        },
        {
          baz: {
            fn: function () {
              returnedBeforeLastTest = false;
              return false;
            }
          }
        }
      ];

    should(testFilterRecursively({result: true}, filters, {}, 'or')).be.true();
    should(returnedBeforeLastTest).be.true();

    should(testFilterRecursively({ result: false}, filters, {}, 'or')).be.false();
  });
});
