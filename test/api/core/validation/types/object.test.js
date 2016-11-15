var
  BaseType = require('../../../../../lib/api/core/validation/baseType'),
  ObjectType = require('../../../../../lib/api/core/validation/types/object'),
  should = require('should');

describe('Test: validation/types/object', () => {
  var objectType = new ObjectType();

  it('should derivate from BaseType', () => {
    should(BaseType.prototype.isPrototypeOf(objectType)).be.true();
  });

  it('should construct properly', () => {
    should(typeof objectType.typeName).be.eql('string');
    should(typeof objectType.allowChildren).be.eql('boolean');
    should(Array.isArray(objectType.allowedTypeOptions)).be.true();
    should(objectType.typeName).be.eql('object');
    should(objectType.allowChildren).be.true();
  });

  it('should override functions properly',() => {
    should(typeof ObjectType.prototype.validate).be.eql('function');
    should(typeof ObjectType.prototype.validateFieldSpecification).be.eql('function');
    should(typeof ObjectType.prototype.getStrictness).be.eql('function');
  });

  describe('#validate', () => {
    it('should return true if the value is an object', () => {
      should(objectType.validate({}, {})).be.true();
    });

    it('should return false if the value is not an object', () => {
      var errorMessages = [];

      should(objectType.validate({}, 'a string', errorMessages)).be.false();
      should(errorMessages).be.deepEqual(['The value must be an object.']);
    });
  });

  describe('#validateFieldSpecification', () => {
    it('should be true if typeOptions is empty', () => {
      should(objectType.validateFieldSpecification({})).be.true();
    });

    it('should be false if the strict option is not a boolean', () => {
      should(objectType.validateFieldSpecification({strict: 'not a boolean'})).be.false();
    });
  });

  describe('#getStrictness', () => {
    it('should return parentStrictness if strict is not defined in typeOptions', () => {
      should(objectType.getStrictness({}, true)).be.true();
    });

    it('should return parentStrictness if strict is not defined in typeOptions', () => {
      should(objectType.getStrictness({}, false)).be.false();
    });

    it('should return strict option if defined', () => {
      should(objectType.getStrictness({strict: true}, false)).be.true();
    });
  });
});
