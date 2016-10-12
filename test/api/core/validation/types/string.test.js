var
  BaseType = require('../../../../../lib/api/core/validation/baseType'),
  StringType = require('../../../../../lib/api/core/validation/types/string'),
  should = require('should');

describe('Test: validation/types/string', () => {
  it('should derivate from BaseType', () => {
    var stringType = new StringType();

    should(BaseType.prototype.isPrototypeOf(stringType)).be.true();
  });

  it('should construct properly', () => {
    var stringType = new StringType();

    should(typeof stringType.typeName).be.eql('string');
    should(typeof stringType.allowChildren).be.eql('boolean');
    should(Array.isArray(stringType.allowedTypeOptions)).be.true();
  });

  it('should override functions properly',() => {
    should(typeof StringType.prototype.validate).be.eql('function');
    should(typeof StringType.prototype.validateFieldSpecification).be.eql('function');
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
