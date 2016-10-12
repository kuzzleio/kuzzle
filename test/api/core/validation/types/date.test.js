var
  BaseType = require('../../../../../lib/api/core/validation/baseType'),
  AnythingType = require('../../../../../lib/api/core/validation/types/date'),
  should = require('should');

describe('Test: validation/types/date', () => {
  it('should derivate from BaseType', () => {
    var anythingType = new AnythingType();

    should(BaseType.prototype.isPrototypeOf(anythingType)).be.true();
  });

  it('should construct properly', () => {
    var anythingType = new AnythingType();

    should(typeof anythingType.typeName).be.eql('string');
    should(typeof anythingType.allowChildren).be.eql('boolean');
    should(Array.isArray(anythingType.allowedTypeOptions)).be.true();
  });

  it('should override functions properly',() => {
    should(typeof AnythingType.prototype.validate).be.eql('function');
    should(typeof AnythingType.prototype.validateFieldSpecification).be.eql('function');
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
