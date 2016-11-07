var
  BaseType = require('../../../../../lib/api/core/validation/baseType'),
  BooleanType = require('../../../../../lib/api/core/validation/types/boolean'),
  should = require('should');

describe('Test: validation/types/boolean', () => {
  var booleanType = new BooleanType();

  it('should derivate from BaseType', () => {
    should(BaseType.prototype.isPrototypeOf(booleanType)).be.true();
  });

  it('should construct properly', () => {
    should(typeof booleanType.typeName).be.eql('string');
    should(typeof booleanType.allowChildren).be.eql('boolean');
    should(Array.isArray(booleanType.allowedTypeOptions)).be.true();
    should(booleanType.typeName).be.eql('boolean');
    should(booleanType.allowChildren).be.false();
  });

  it('should override functions properly',() => {
    should(typeof BooleanType.prototype.validate).be.eql('function');
    should(typeof BooleanType.prototype.validateFieldSpecification).be.eql('function');
  });

  describe('#validate', () => {
    it('should return true if fieldValue is a boolean', () => {
      var
        typeOptions = {},
        fieldValue = true,
        errorMessages = [];

      should(booleanType.validate(typeOptions, fieldValue, errorMessages)).be.true();
    });

    it('should return false if fieldValue is not a boolean', () => {
      var
        typeOptions = {},
        fieldValue = 'string',
        errorMessages = [];

      should(booleanType.validate(typeOptions, fieldValue, errorMessages)).be.false();
      should(errorMessages).be.deepEqual(['The field must be of type boolean.']);
    });
  });

  describe('#validateFieldSpecification', () => {
    it('should always return true', () => {
      should(booleanType.validateFieldSpecification()).be.true();
    });
  });
});
