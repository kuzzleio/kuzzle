var
  BaseType = require('../../../../../lib/api/core/validation/baseType'),
  EnumType = require('../../../../../lib/api/core/validation/types/enum'),
  should = require('should');

describe('Test: validation/types/enum', () => {
  it('should derivate from BaseType', () => {
    var enumType = new EnumType();

    should(BaseType.prototype.isPrototypeOf(enumType)).be.true();
  });

  it('should construct properly', () => {
    var enumType = new EnumType();

    should(typeof enumType.typeName).be.eql('string');
    should(typeof enumType.allowChildren).be.eql('boolean');
    should(Array.isArray(enumType.allowedTypeOptions)).be.true();
  });

  it('should override functions properly',() => {
    should(typeof EnumType.prototype.validate).be.eql('function');
    should(typeof EnumType.prototype.validateFieldSpecification).be.eql('function');
  });

  describe('#validate', () => {
    /**
     * TODO
     */
  });

  describe('#validateFieldSpecification', () => {
    /**
     * TODO
     */
  });
});
