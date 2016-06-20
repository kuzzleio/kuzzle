var
  md5 = require('crypto-md5'),
  sinon = require('sinon'),
  should = require('should'),
  Methods = require.main.require('lib/api/dsl/methods');

describe('Test: dsl.regexp method', () => {
  var
    roomId = 'roomId',
    index = 'index',
    collection = 'colection',
    methods;

  methods = new Methods({});
  
  beforeEach(() => {
    methods.filters.add = sinon.spy(() => {
      return {
        diff: {},
        path: 'path',
        filters: {}
      };
    });
  });

  it('should reject the promise if the argument is not valid', () => {
    return should(methods.regexp(roomId, index, collection, 'invalid'))
      .be.rejectedWith('Regexp argument must be an object');
  });
  
  it('should reject the promise if more than one field if given', () => {
    return should(methods.regexp(roomId, index, collection, { 
      first: '.*',
      second: '.*'
    }))
      .be.rejectedWith('Regexp can take only one field entry');
  });

  it('should reject the promise if an invalid regexp is given', () => {
    return should(methods.regexp(roomId, index, collection, { foo: '(unclosed parenthesis' }))
      .be.rejectedWith(SyntaxError);
  });
  
  it('should reject the promise if filters::add returns an error', () => {
    var error = new Error('');
    
    methods.filters.add = sinon.stub().returns(error);
    
    return should(methods.regexp(roomId, index, collection, { foo: '.*'}))
      .be.rejectedWith(error);
  });

  it('should reject the promise if no regex is given', () => {
    return should(methods.regexp(roomId, index, collection, { foo: {} }))
      .be.rejectedWith('Missing regexp value');
  });

  it('should call filter.add with proper values on a simple regex', () => {
    return methods.regexp(roomId, index, collection, { foo: '^test.*$' })
      .then(() => {
        should(methods.filters.add).be.calledOnce();
        should(methods.filters.add).be.calledWith(
          index,
          collection,
          'foo',
          'regexp',
          '/^test.*$/',
          'regexpfoo/^test.*$/',
          roomId
        );
      });
  });

  it('should call filter.add with proper values when using the more complex form', () => {
    return methods.regexp(roomId, index, collection, { foo: { value: '^test.*$', flags: 'ig' }})
      .then(() => {
        should(methods.filters.add).be.calledOnce();
        should(methods.filters.add).be.calledWith(
          index,
          collection,
          'foo',
          'regexp',
          '/^test.*$/gi',
          'regexpfoo/^test.*$/gi',
          roomId
        );

      });
  });


});
