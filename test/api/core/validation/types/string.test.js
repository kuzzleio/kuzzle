var
  BaseType = require('../../../../../lib/api/core/validation/baseType'),
  StringType = require('../../../../../lib/api/core/validation/types/string'),
  should = require('should');

describe('Test: validation/types/string', () => {
  var stringType = new StringType();

  it('should derivate from BaseType', () => {
    should(BaseType.prototype.isPrototypeOf(stringType)).be.true();
  });

  it('should construct properly', () => {
    should(typeof stringType.typeName).be.eql('string');
    should(typeof stringType.allowChildren).be.eql('boolean');
    should(Array.isArray(stringType.allowedTypeOptions)).be.true();
    should(stringType.typeName).be.eql('string');
    should(stringType.allowChildren).be.false();
  });

  it('should override functions properly',() => {
    should(typeof StringType.prototype.validate).be.eql('function');
    should(typeof StringType.prototype.validateFieldSpecification).be.eql('function');
  });

  describe('#validate', () => {
    var stringType = new StringType();

    it('should return true if the value is valid', () => {
      should(stringType.validate({}, 'a string', [])).be.true();
    });

    it('should return true if the value is valid', () => {
      should(stringType.validate({length: {min:7, max: 9}}, 'a string', [])).be.true();
    });

    it('should return false if the value is not valid', () => {
      var errorMessage = [];

      should(stringType.validate({}, {not: 'a string'}, errorMessage)).be.false();
      should(errorMessage).be.deepEqual(['The field must be a string.']);
    });

    it('should return false if the value is not valid', () => {
      var errorMessage = [];

      should(stringType.validate({length: {min: 10}}, 'a string', errorMessage)).be.false();
      should(errorMessage).be.deepEqual(['The string is not long enough.']);
    });

    it('should return false if the value is not valid', () => {
      var errorMessage = [];

      should(stringType.validate({length: {max: 5}}, 'a string', errorMessage)).be.false();
      should(errorMessage).be.deepEqual(['The string is too long.']);
    });
  });

  describe('#validateFieldSpecification', () => {
    it('should return true if there is no typeOptions', () => {
      should(stringType.validateFieldSpecification({})).be.true();
    });

    it('should return true if typeOptions is set properly', () => {
      should(stringType.validateFieldSpecification({
        length: {
          min: 41,
          max: 42
        }
      })).be.true();
    });

    it('should return false if length is not set properly', () => {
      should(stringType.validateFieldSpecification({
        length: 'not proper'
      })).be.false();
    });

    it('should return false if min is greater than max', () => {
      should(stringType.validateFieldSpecification({
        length: {
          min: 42,
          max: 41
        }
      })).be.false();
    });
  });
});
