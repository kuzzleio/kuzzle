var
  BaseType = require('../../../../../lib/api/core/validation/baseType'),
  IntegerType = require('../../../../../lib/api/core/validation/types/integer'),
  should = require('should');

describe('Test: validation/types/integer', () => {
  var integerType = new IntegerType();

  it('should derivate from BaseType', () => {
    should(BaseType.prototype.isPrototypeOf(integerType)).be.true();
  });

  it('should construct properly', () => {
    should(typeof integerType.typeName).be.eql('string');
    should(typeof integerType.allowChildren).be.eql('boolean');
    should(Array.isArray(integerType.allowedTypeOptions)).be.true();
    should(integerType.typeName).be.eql('integer');
    should(integerType.allowChildren).be.false();
  });

  it('should override functions properly',() => {
    should(typeof IntegerType.prototype.validate).be.eql('function');
    should(typeof IntegerType.prototype.validateFieldSpecification).be.eql('function');
  });

  describe('#validate', () => {
    var
      emptyTypeOptions = {},
      rangeTypeOptions = {
        range: {
          min: 41,
          max: 42
        }
      };

    it('should return true if fieldValue is valid', () => {
      should(integerType.validate(emptyTypeOptions, 25, [])).be.true();
    });

    it('should return true if fieldValue is valid and in range', () => {
      should(integerType.validate(rangeTypeOptions, 42, [])).be.true();
    });

    it('should return false if fieldValue is not a number', () => {
      var errorMessages = [];

      should(integerType.validate(emptyTypeOptions, 'a string', errorMessages)).be.false();
      should(errorMessages).be.deepEqual(['The field must be an integer.']);
    });

    it('should return false if fieldValue is not an integer', () => {
      var errorMessages = [];

      should(integerType.validate(emptyTypeOptions, 42.42, errorMessages)).be.false();
      should(errorMessages).be.deepEqual(['The field must be an integer.']);
    });

    it('should return false if fieldValue is below min', () => {
      var errorMessages = [];

      should(integerType.validate(rangeTypeOptions, 40, errorMessages)).be.false();
      should(errorMessages).be.deepEqual(['The value is lesser than the minimum.']);
    });

    it('should return false if fieldValue is above max', () => {
      var errorMessages = [];

      should(integerType.validate(rangeTypeOptions, 43, errorMessages)).be.false();
      should(errorMessages).be.deepEqual(['The value is greater than the maximum.']);
    });
  });

  describe('#validateFieldSpecification', () => {
    it('should return true if there is no typeOptions', () => {
      should(integerType.validateFieldSpecification({})).be.true();
    });

    it('should return true if typeOptions is set properly', () => {
      should(integerType.validateFieldSpecification({
        range: {
          min: 41,
          max: 42
        }
      })).be.true();
    });

    it('should return false if range is not set properly', () => {
      should(integerType.validateFieldSpecification({
        range: 'not proper'
      })).be.false();
    });

    it('should return false if min is greater than max', () => {
      should(integerType.validateFieldSpecification({
        range: {
          min: 42,
          max: 41
        }
      })).be.false();
    });
  });
});
