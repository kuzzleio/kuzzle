var
  should = require('should'),
  rewire = require('rewire'),
  Dsl = rewire('../../../../lib/api/dsl/index');

describe('Test: dsl.flattenObject', function () {
  var
    flattenObject = Dsl.__get__('flattenObject');

  it('should return an empty object when given one as an argument', function () {
    should(flattenObject({})).be.an.Object().and.be.empty();
  });

  it('should flatten an object', function () {
    var result = flattenObject({ foo: { bar: 'bar', baz: { SchrodingerCat: 'Dead'}}});

    should.not.exist(result.foo);
    should(result['foo.bar']).not.be.undefined().and.be.exactly('bar');
    should.not.exist(result['foo.baz']);
    should(result['foo.baz.SchrodingerCat']).not.be.undefined().and.be.exactly('Dead');
  });

  it('should keep arrays unchanged', function () {
    var
      arr = ['bar', 'baz'],
      result = flattenObject({ foo: arr});

    should(result.foo).not.be.undefined().and.be.an.Array().and.match(arr);
  });
});
