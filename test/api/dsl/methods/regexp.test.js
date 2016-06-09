var
  md5 = require('crypto-md5'),
  sinon = require('sinon'),
  should = require('should'),
  Methods = require.main.require('lib/api/dsl/methods'),
  sandbox = sinon.sandbox.create();
require('should-sinon');

describe('Test: dsl.regexp method', () => {
  var
    roomId = 'roomId',
    index = 'index',
    collection = 'colection',
    methods;

  methods = new Methods({});
  methods.filters.add = sinon.spy(() => {
    return {
      diff: {},
      path: 'path',
      filters: {}
    };
  });

  beforeEach(() => {
    sandbox.restore();
    methods.filters.add.reset();
  });

  it('should reject the promise if the argument is not valid', () => {
    return should(methods.regexp(roomId, index, collection, 'invalid'))
      .be.rejectedWith('Regexp argument must be an object');
  });

  it('should reject the promise if an invalid regexp is given', () => {
    return should(methods.regexp(roomId, index, collection, { foo: '(unclosed parenthesis' }))
      .be.rejectedWith(SyntaxError);
  });

  it('should reject the promise if no regex is given', () => {
    return should(methods.regexp(roomId, index, collection, { foo: {} }))
      .be.rejectedWith('Missing regexp value');
  });

  it('should call filter.add with proper values on a simple regex', () => {
    return methods.regexp(roomId, index, collection, { foo: '^test.*$' })
      .then(() => {
        var hashedFunctionName = md5('regexpfoo/^test.*$/');

        should(methods.filters.add).be.calledOnce();
        should(methods.filters.add).be.calledWith(
          index,
          collection,
          'foo',
          'regexp',
          '/^test.*$/',
          hashedFunctionName,
          roomId
        );
      });
  });

  it('should call filter.add with proper values when using the more complex form', () => {
    return methods.regexp(roomId, index, collection, { foo: { value: '^test.*$', flags: 'ig' }})
      .then(() => {
        var hashedFunctionName = md5('regexpfoo/^test.*$/gi');

        should(methods.filters.add).be.calledOnce();
        should(methods.filters.add).be.calledWith(
          index,
          collection,
          'foo',
          'regexp',
          '/^test.*$/gi',
          hashedFunctionName,
          roomId
        );

      });
  });


});
