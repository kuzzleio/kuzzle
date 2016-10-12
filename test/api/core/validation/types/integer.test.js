var
  BaseType = require('../../../../../lib/api/core/validation/baseType'),
  IntegerType = require('../../../../../lib/api/core/validation/types/integer'),
  should = require('should');

describe('Test: validation/types/integer', () => {
  it('should derivate from BaseType', () => {
    var integerType = new IntegerType();

    should(BaseType.prototype.isPrototypeOf(integerType)).be.true();
  });

  it('should construct properly', () => {
    var integerType = new IntegerType();

    should(typeof integerType.typeName).be.eql('string');
    should(typeof integerType.allowChildren).be.eql('boolean');
    should(Array.isArray(integerType.allowedTypeOptions)).be.true();
  });

  it('should override functions properly',() => {
    should(typeof IntegerType.prototype.validate).be.eql('function');
    should(typeof IntegerType.prototype.validateFieldSpecification).be.eql('function');
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
