var
  BaseType = require('../../../../../lib/api/core/validation/baseType'),
  NumericType = require('../../../../../lib/api/core/validation/types/numeric'),
  should = require('should');

describe('Test: validation/types/numeric', () => {
  var numericType = new NumericType();

  it('should derivate from BaseType', () => {
    should(BaseType.prototype.isPrototypeOf(numericType)).be.true();
  });

  it('should construct properly', () => {
    should(typeof numericType.typeName).be.eql('string');
    should(typeof numericType.allowChildren).be.eql('boolean');
    should(Array.isArray(numericType.allowedTypeOptions)).be.true();
    should(numericType.typeName).be.eql('numeric');
    should(numericType.allowChildren).be.false();
  });

  it('should override functions properly',() => {
    should(typeof NumericType.prototype.validate).be.eql('function');
    should(typeof NumericType.prototype.validateFieldSpecification).be.eql('function');
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
      should(numericType.validate(emptyTypeOptions, 25.25, [])).be.true();
    });

    it('should return true if fieldValue is valid and in range', () => {
      should(numericType.validate(rangeTypeOptions, 41.5, [])).be.true();
    });

    it('should return false if fieldValue is not a number', () => {
      var errorMessages = [];

      should(numericType.validate(emptyTypeOptions, 'a string', errorMessages)).be.false();
      should(errorMessages).be.deepEqual(['The field must be a number.']);
    });

    it('should return false if fieldValue is below min', () => {
      var errorMessages = [];

      should(numericType.validate(rangeTypeOptions, 40.1, errorMessages)).be.false();
      should(errorMessages).be.deepEqual(['The value is lesser than the minimum.']);
    });

    it('should return false if fieldValue is above max', () => {
      var errorMessages = [];

      should(numericType.validate(rangeTypeOptions, 43.1, errorMessages)).be.false();
      should(errorMessages).be.deepEqual(['The value is greater than the maximum.']);
    });
  });

  describe('#validateFieldSpecification', () => {
    it('should return true if there is no typeOptions', () => {
      should(numericType.validateFieldSpecification({})).be.true();
    });

    it('should return true if typeOptions is set properly', () => {
      should(numericType.validateFieldSpecification({
        range: {
          min: 41,
          max: 42
        }
      })).be.true();
    });

    it('should return false if range is not set properly', () => {
      should(numericType.validateFieldSpecification({
        range: 'not proper'
      })).be.false();
    });

    it('should return false if min is greater than max', () => {
      should(numericType.validateFieldSpecification({
        range: {
          min: 42,
          max: 41
        }
      })).be.false();
    });
  });
});
