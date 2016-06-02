var
  should = require('should'),
  rewire = require('rewire'),
  sinon = require('sinon'),
  Dsl = rewire('../../../../lib/api/dsl/index');

describe('Test: dsl.testFilterRecursively', function () {
  var
    testFilterRecursively = Dsl.__get__('testFilterRecursively');

  it('should return the result of the filter if no upper operand is provided', function () {
    var
      filter1 = {
        foo: {
          args: {
            operator: 'term',
            not: true,
            field: 'foo',
            value: 'bar'
          }
        }
      },
      filter2 = {
        foo: {
          args: {
            operator: 'term',
            not: false,
            field: 'foo',
            value: 'bar'
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
          args: {
            operator: 'term',
            not: true,
            field: 'foo.bar',
            value: 'bar'
          }
        }
      },
      filter2 = {
        foo: {
          args: {
            operator: 'term',
            not: false,
            field: 'foo.bar',
            value: 'bar'
          }
        }
      };

    should(testFilterRecursively({}, filter1, {}, 'foo')).be.undefined();
    should(testFilterRecursively({}, filter2, {}, 'foo')).be.undefined();
  });

  it('should return the final result of an AND filter set', function () {
    var stub = sinon.stub();

    filters = {
      foo: {
        args: {operator: 'term', not: true, field: 'foo.bar', value: 'bar'}
      },
      bar: {
        args: {operator: 'term', not: true, field: 'foo.bar', value: 'bar'}
      },
      baz: {
        args: {operator: 'term', not: true, field: 'foo.bar', value: 'bar'}
      }
    };

    stub.onFirstCall().returns(true);
    stub.onSecondCall().returns(true);
    stub.onThirdCall().returns(true);

    Dsl.__with__({
      evalFilterArguments: stub
    })(function () {
      var dsl = new Dsl({});
      testFilterRecursively.call(dsl, {}, filters, {}, 'and');
      should(stub.callCount).be.eql(3);
      stub.reset();

      stub.onSecondCall().returns(false);
      testFilterRecursively.call(dsl, {}, filters, {}, 'and');
      should(stub.callCount).be.eql(2);
    });
  });

  it('should return the final result of an OR filter set', function () {
    var stub = sinon.stub();

    filters = {
      foo: {
        args: {operator: 'term', not: true, field: 'foo.bar', value: 'bar'}
      },
      bar: {
        args: {operator: 'term', not: true, field: 'foo.bar', value: 'bar'}
      },
      baz: {
        args: {operator: 'term', not: true, field: 'foo.bar', value: 'bar'}
      }
    };

    stub.onFirstCall().returns(true);
    stub.onSecondCall().returns(true);
    stub.onThirdCall().returns(true);

    Dsl.__with__({
      evalFilterArguments: stub
    })(function () {
      var dsl = new Dsl({});
      testFilterRecursively.call(dsl, {}, filters, {}, 'or');
      should(stub.callCount).be.eql(1);
      stub.reset();

      stub.onFirstCall().returns(false);
      stub.onSecondCall().returns(false);
      testFilterRecursively.call(dsl, {}, filters, {}, 'or');
      should(stub.callCount).be.eql(3);
    });
  });
});
