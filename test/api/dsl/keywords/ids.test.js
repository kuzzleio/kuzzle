'use strict';

var
  should = require('should'),
  BadRequestError = require('kuzzle-common-objects').errors.BadRequestError,
  DSL = require('../../../../lib/api/dsl');

describe('DSL.keyword.ids', () => {
  var dsl;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('#validation', () => {
    it('should reject empty filters', () => {
      return should(dsl.validate({ids: {}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with other fields other than the "values" one', () => {
      return should(dsl.validate({ids: {foo: ['foo']}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with multiple defined attributes', () => {
      return should(dsl.validate({ids: {values: ['foo'], foo: ['foo']}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with an empty value list', () => {
      return should(dsl.validate({ids: {values: []}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters with non-array values attribute', () => {
      return should(dsl.validate({ids: {values: 'foo'}})).be.rejectedWith(BadRequestError);
    });

    it('should reject filters containing a non-string value', () => {
      return should(dsl.validate({ids: {values: ['foo', 'bar', 42, 'baz']}})).be.rejectedWith(BadRequestError);
    });

    it('should validate a well-formed ids filter', () => {
      return should(dsl.validate({ids: {values: ['foo', 'bar', 'baz']}})).be.fulfilledWith(true);
    });
  });

  describe('#standardization', () => {
    it('should return a list of "equals" conditions in a "or" operand', () => {
      return should(dsl.transformer.standardizer.standardize({ids: {values: ['foo', 'bar', 'baz']}}))
        .be.fulfilledWith({or: [
          {equals: {_id: 'foo'}},
          {equals: {_id: 'bar'}},
          {equals: {_id: 'baz'}}
        ]});
    });
  });
});
