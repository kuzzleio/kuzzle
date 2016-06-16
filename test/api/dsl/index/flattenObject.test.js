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

    // the entry 'foo' must still exists because the user can perform a subscribe on {exists: {field: 'foo'}}
    should.exist(result.foo);
    should(result['foo.bar']).not.be.eql(undefined).and.be.exactly('bar');
    // the entry 'foo.baz' must still exists because the user can perform a subscribe on {exists: {field: 'foo.baz'}}
    should.exist(result['foo.baz']);
    should(result['foo.baz.SchrodingerCat']).not.be.eql(undefined).and.be.exactly('Dead');
  });

  it('should keep arrays unchanged', function () {
    var
      arr = ['bar', 'baz'],
      result = flattenObject({ foo: arr});

    should(result.foo).not.be.eql(undefined).and.be.an.Array().and.match(arr);
  });

  it('should automatically inject the provided ID', function () {
    var result = flattenObject({ foo: { bar: 'bar', baz: { SchrodingerCat: 'Dead'}}}, 'foobar');
    should(result._id).be.eql('foobar');
  });
});
