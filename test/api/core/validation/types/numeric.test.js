var
  BaseType = require('../../../../../lib/api/core/validation/baseType'),
  NumericType = require('../../../../../lib/api/core/validation/types/numeric'),
  should = require('should');

describe('Test: validation/types/numeric', () => {
  it('should derivate from BaseType', () => {
    var numericType = new NumericType();

    should(BaseType.prototype.isPrototypeOf(numericType)).be.true();
  });

  it('should construct properly', () => {
    var numericType = new NumericType();

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
