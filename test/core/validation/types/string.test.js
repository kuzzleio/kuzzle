'use strict';

const should = require('should');

const BaseType = require('../../../../lib/core/validation/baseType');
const StringType = require('../../../../lib/core/validation/types/string');
const { PreconditionError } = require('../../../../index');

describe('Test: validation/types/string', () => {
  const stringType = new StringType();

  it('should inherit the BaseType class', () => {
    should(stringType).be.instanceOf(BaseType);
  });

  it('should construct properly', () => {
    should(typeof stringType.typeName).be.eql('string');
    should(typeof stringType.allowChildren).be.eql('boolean');
    should(Array.isArray(stringType.allowedTypeOptions)).be.true();
    should(stringType.typeName).be.eql('string');
    should(stringType.allowChildren).be.false();
  });

  describe('#validate', () => {
    it('should return true if the value is valid', () => {
      should(stringType.validate({}, 'a string', [])).be.true();
    });

    it('should return true if the string length is comprised in the provided length range', () => {
      should(stringType.validate({ length: { min: 7, max: 9 } }, 'a string', [])).be.true();
    });

    it('should return false if the value is not a string', () => {
      [[], {}, 123, null, undefined].forEach(v => {
        const errorMessage = [];

        should(stringType.validate({}, v, errorMessage)).be.false();
        should(errorMessage).be.deepEqual(['The field must be a string.']);
      });
    });

    it('should return false if the value length is below the expected minimum', () => {
      const errorMessage = [];

      should(stringType.validate({ length: { min: 10 } }, 'a string', errorMessage)).be.false();
      should(errorMessage).be.deepEqual(['Invalid string length. Expected min: 10. Received: 8 ("a string")']);
    });

    it('should return false if the value length is above the expected maximum', () => {
      const errorMessage = [];

      should(stringType.validate({ length: { max: 5 } }, 'a string', errorMessage)).be.false();
      should(errorMessage).be.deepEqual(['Invalid string length. Expected max: 5. Received: 8 ("a string")']);
    });
  });

  describe('#validateFieldSpecification', () => {
    it('should validate the typeOptions object is set properly', () => {
      const opts = {
        length: {
          min: 41,
          max: 42
        }
      };

      should(stringType.validateFieldSpecification(opts)).be.eql(opts);
    });

    it('should throw if "length" is not an object', () => {
      [[], undefined, null, 'foobar', 123].forEach(length => {
        should(() => stringType.validateFieldSpecification({ length }))
          .throw(PreconditionError, { id: 'validation.assert.unexpected_properties' });
      });
    });

    it('should throw if an unrecognized property is passed to the length options', () => {
      should(() => stringType.validateFieldSpecification({ length: { foo: 123 } }))
        .throw(PreconditionError, { id: 'validation.assert.unexpected_properties' });
    });

    it('should throw if a non-numeric value is passed to the min or max properties', () => {
      [[], {}, undefined, null, 'foo'].forEach(v => {
        should(() => stringType.validateFieldSpecification({ length: { min: v } }))
          .throw(PreconditionError, { id: 'validation.assert.invalid_type' });

        should(() => stringType.validateFieldSpecification({ length: { max: v } }))
          .throw(PreconditionError, { id: 'validation.assert.invalid_type' });
      });
    });

    it('should throw if min is greater than max', () => {
      should(() => stringType.validateFieldSpecification({
        length: {
          min: 42,
          max: 41
        }
      })).throw(PreconditionError, { id: 'validation.assert.invalid_range' });
    });
  });
});
