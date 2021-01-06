'use strict';

const should = require('should');

const { PreconditionError } = require('../../../../index');
const BaseType = require('../../../../lib/core/validation/baseType');
const EnumType = require('../../../../lib/core/validation/types/enum');

describe('Test: validation/types/enum', () => {
  const enumType = new EnumType();

  it('should inherit the BaseType class', () => {
    should(enumType).be.instanceOf(BaseType);
  });

  it('should construct properly', () => {
    should(typeof enumType.typeName).be.eql('string');
    should(typeof enumType.allowChildren).be.eql('boolean');
    should(Array.isArray(enumType.allowedTypeOptions)).be.true();
    should(enumType.typeName).be.eql('enum');
    should(enumType.allowChildren).be.false();
  });

  describe('#validate', () => {
    const typeOptions = {
      values: ['a string', 'another string', 'one more string']
    };

    it('should return true if fieldValue is a listed value', () => {
      should(enumType.validate(typeOptions, 'another string')).be.true();
    });

    it('should return false if the value is not listed by the enumeration', () => {
      const errorMessage = [];

      should(enumType.validate(typeOptions, 'not the string you are looking for', errorMessage)).be.false();
      should(errorMessage).be.deepEqual([`The field only accepts following values: "${typeOptions.values.join(', ')}".`]);
    });

    it('should return false if the value is not a string', () => {
      const errorMessage = [];

      should(enumType.validate(typeOptions, {not: 'a string'}, errorMessage)).be.false();
      should(errorMessage).be.deepEqual(['The field must be a string.']);
    });
  });

  describe('#validateFieldSpecification', () => {
    it('should throw if no values are provided', () => {
      should(() => enumType.validateFieldSpecification({}))
        .throw(PreconditionError, { id: 'validation.types.missing_enum_values' });

      should(() => enumType.validateFieldSpecification({values: []}))
        .throw(PreconditionError, { id: 'validation.assert.invalid_type' });

      should(() => enumType.validateFieldSpecification({values: 'foobar'}))
        .throw(PreconditionError, { id: 'validation.assert.invalid_type' });
    });

    it('should throw if a listed value is not a string', () => {
      should(() => enumType.validateFieldSpecification({values: [true, 42, 'a string']}))
        .throw(PreconditionError, { id: 'validation.assert.invalid_type' });

      should(() => enumType.validateFieldSpecification({values: ['a string', null]}))
        .throw(PreconditionError, { id: 'validation.assert.invalid_type' });
    });

    it('should return the options intact if it is valid', () => {
      should(enumType.validateFieldSpecification({
        values: ['a string', 'another string', 'one more string']
      })).be.deepEqual({
        values: ['a string', 'another string', 'one more string']
      });
    });
  });
});
