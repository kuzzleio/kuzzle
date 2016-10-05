var
  should = require('should'),
  rewire = require('rewire'),
  md5 = require('crypto-md5'),
  Filters = require.main.require('lib/api/dsl/filters'),
  Methods = rewire('../../../../lib/api/dsl/methods'),
  BadRequestError = require.main.require('kuzzle-common-objects').Errors.badRequestError,
  InternalError = require.main.require('kuzzle-common-objects').Errors.internalError;

describe('Test: dsl.equalsFunction method', () => {
  var
    methods,
    equalsFunction = Methods.__get__('equalsFunction'),
    equalsfoobar = md5('equalsfoobar'),
    infoobarbaz = md5('infoobar,baz'),
    notequalsfoobar = md5('notequalsfoobar'),
    notinfoobarbaz = md5('notinfoobar,baz'),
    fieldFoo = md5('foo');

  beforeEach(() => {
    methods = new Methods(new Filters());
    equalsFunction = equalsFunction.bind(methods);
  });

  it('should return a rejected promise if the provided filter is empty', () => {
    return should(equalsFunction('equals', 'roomId', 'collection', {})).be.rejectedWith(BadRequestError, { message: 'A filter can\'t be empty' });
  });

  it('should return a rejected promise if the value given for a "in" filter is not an array', () => {
    var
      filter = {
        foo: 'bar'
      };

    return should(equalsFunction('in', 'roomId', 'index', 'collection', filter)).be.rejectedWith(BadRequestError, { message: 'Filter in must contains an array' });
  });

  it('should create a valid "equals" filter', () => {
    var
      filter = {
        foo: 'bar'
      };

    return equalsFunction('equals', 'roomId', 'index', 'collection', filter)
      .then(response => response.filter)
      .then(formattedFilter => {
        should.exist(formattedFilter[`index.collection.${fieldFoo}.${equalsfoobar}`]);
        should(formattedFilter[`index.collection.${fieldFoo}.${equalsfoobar}`].ids).be.an.Array().and.match(['roomId']);
        should(formattedFilter[`index.collection.${fieldFoo}.${equalsfoobar}`].args).match({
          operator: 'equals', not: undefined, field: 'foo', value: 'bar'
        });
      });
  });

  it('should create a valid "in" filter', () => {
    var
      filter = {
        foo: ['bar', 'baz']
      };

    return equalsFunction('in', 'roomId', 'index', 'collection', filter)
      .then(response => response.filter)
      .then(formattedFilter => {
        should.exist(formattedFilter[`index.collection.${fieldFoo}.${infoobarbaz}`]);
        should(formattedFilter[`index.collection.${fieldFoo}.${infoobarbaz}`].ids).be.an.Array().and.match(['roomId']);
        should(formattedFilter[`index.collection.${fieldFoo}.${infoobarbaz}`].args).match({
          operator: 'in',
          not: undefined,
          field: 'foo',
          value: [ 'bar', 'baz' ]
        });
      });
  });

  it('should create a valid "not-equals" filter', () => {
    var
      filter = {
        foo: 'bar'
      };

    return equalsFunction('equals', 'roomId', 'index', 'collection', filter, true)
      .then(response => response.filter)
      .then(formattedFilter => {
        should.exist(formattedFilter[`index.collection.${fieldFoo}.${notequalsfoobar}`]);
        should(formattedFilter[`index.collection.${fieldFoo}.${notequalsfoobar}`].ids).be.an.Array().and.match(['roomId']);
        should(formattedFilter[`index.collection.${fieldFoo}.${notequalsfoobar}`].args).match({
          operator: 'equals', not: true, field: 'foo', value: 'bar'
        });
      });
  });

  it('should create a valid "not-in" filter', () => {
    var
      filter = {
        foo: ['bar', 'baz']
      };

    return equalsFunction('in', 'roomId', 'index', 'collection', filter, true)
      .then(response => response.filter)
      .then(formattedFilter => {
        should.exist(formattedFilter[`index.collection.${fieldFoo}.${notinfoobarbaz}`]);
        should(formattedFilter[`index.collection.${fieldFoo}.${notinfoobarbaz}`].ids).be.an.Array().and.match(['roomId']);
        should(formattedFilter[`index.collection.${fieldFoo}.${notinfoobarbaz}`].args).match({
          operator: 'in',
          not: true,
          field: 'foo',
          value: [ 'bar', 'baz' ]
        });
      });
  });

  it('should return a rejected promise if filters.add fails', () => {
    var
      filter = {
        foo: ['bar', 'baz']
      };

    methods.filters.add = () => { return new InternalError('rejected'); };

    return should(Methods.__get__('equalsFunction').call(methods, 'in', 'roomId', 'index', 'collection', filter)).be.rejectedWith('rejected');
  });
});
