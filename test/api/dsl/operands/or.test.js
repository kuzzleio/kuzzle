'use strict';

var
  should = require('should'),
  BadRequestError = require('kuzzle-common-objects').Errors.badRequestError,
  DSL = require('../../../../lib/api/dsl');

describe('DSL.operands.or', () => {
  var dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#validation', () => {
    it('should reject empty filters', () => {
      return should(dsl.validate({or: []})).be.rejectedWith(BadRequestError);
    });

    it('should reject non-array content', () => {
      return should(dsl.validate({or: {foo: 'bar'}})).be.rejectedWith(BadRequestError);
    });

    it('should reject if one of the content is not an object', () => {
      return should(dsl.validate({or: [{equals: {foo: 'bar'}}, [{exists: {field: 'foo'}}]]})).be.rejectedWith(BadRequestError);
    });

    it('should reject if one of the content object does not refer to a valid keyword', () => {
      return should(dsl.validate({or: [{equals: {foo: 'bar'}}, {foo: 'bar'}]})).be.rejectedWith(BadRequestError);
    });

    it('should reject if one of the content object is not a well-formed keyword', () => {
      return should(dsl.validate({or: [{equals: {foo: 'bar'}}, {exists: {foo: 'bar'}}]})).be.rejectedWith(BadRequestError);
    });

    it('should validate a well-formed "and" operand', () => {
      return should(dsl.validate({or: [{equals: {foo: 'bar'}}, {exists: {field: 'bar'}}]})).be.fulfilledWith(true);
    });
  });

  describe('#matching', () => {
    it('should match a document if at least 1 condition is fulfilled', () => {
      return dsl.register('index', 'collection', {or: [{equals: {foo: 'bar'}}, {missing: {field: 'bar'}}, {range: {baz: {lt: 42}}}]})
        .then(subscription => {
          var result = dsl.test('index', 'collection', {foo: 'foo', bar: 'baz', baz: 13});

          should(result).be.an.Array().and.not.empty();
          should(result[0]).be.eql(subscription.id);
        });
    });

    it('should not match if the document misses all conditions', () => {
      return dsl.register('index', 'collection', {or: [{equals: {foo: 'bar'}}, {missing: {field: 'bar'}}, {range: {baz: {lt: 42}}}]})
        .then(() => {
          should(dsl.test('index', 'collection', {foo: 'foo', bar: 'baz', baz: 42})).be.an.Array().and.empty();
        });
    });
  });

  describe('#removal', () => {
    it('should destroy all associated keywords to an OR operand', () => {
      let id;

      return dsl.register('index', 'collection', {or: [{equals: {foo: 'bar'}}, {missing: {field: 'bar'}}, {range: {baz: {lt: 42}}}]})
        .then(subscription => {
          id = subscription.id;
          return dsl.register('index', 'collection', {exists: {field: 'foo'}});
        })
        .then(() => dsl.remove(id))
        .then(() => {
          should(dsl.storage.foPairs.index.collection.exists).be.an.Object();
          should(dsl.storage.foPairs.index.collection.equals).be.undefined();
          should(dsl.storage.foPairs.index.collection.notexists).be.undefined();
          should(dsl.storage.foPairs.index.collection.range).be.undefined();
        });
    });
  });
});
