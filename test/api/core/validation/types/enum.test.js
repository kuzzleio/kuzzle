var
  BaseType = require('../../../../../lib/api/core/validation/baseType'),
  EnumType = require('../../../../../lib/api/core/validation/types/enum'),
  should = require('should');

describe('Test: validation/types/enum', () => {
  var enumType = new EnumType();

  it('should derivate from BaseType', () => {
    should(BaseType.prototype.isPrototypeOf(enumType)).be.true();
  });

  it('should construct properly', () => {
    should(typeof enumType.typeName).be.eql('string');
    should(typeof enumType.allowChildren).be.eql('boolean');
    should(Array.isArray(enumType.allowedTypeOptions)).be.true();
    should(enumType.typeName).be.eql('enum');
    should(enumType.allowChildren).be.false();
  });

  it('should override functions properly',() => {
    should(typeof EnumType.prototype.validate).be.eql('function');
    should(typeof EnumType.prototype.validateFieldSpecification).be.eql('function');
  });

  describe('#validate', () => {
    var typeOptions = {
      values: ['a string', 'another string', 'one more string']
    };

    it('should return true if fieldValue has a valid value', () => {
      should(enumType.validate(typeOptions, 'another string')).be.true();
    });

    it('should return false if the value is not valid', () => {
      var errorMessage = [];

      should(enumType.validate(typeOptions, 'not the string you are looking for', errorMessage)).be.false();
      should(errorMessage).be.deepEqual([`The field only accepts following values: "${typeOptions.values.join(', ')}".`]);
    });

    it('should return false if the value is not valid', () => {
      var errorMessage = [];

      should(enumType.validate(typeOptions, {not: 'a string'}, errorMessage)).be.false();
      should(errorMessage).be.deepEqual(['The field must be a string.']);
    });
  });

  describe('#validateFieldSpecification', () => {
    it('should return false if no values are provided', () => {
      should(enumType.validateFieldSpecification({values: []})).be.false();
    });

    it('should return false if a value is not a string', () => {
      should(enumType.validateFieldSpecification({values: [true, 42, 'a string']})).be.false();
    });

    it('should return true if all provided values are strings', () => {
      should(enumType.validateFieldSpecification({
        values: ['a string', 'another string', 'one more string']
      })).be.true();
    });
  });
});
