var
  BaseType = require('../../../../../lib/api/core/validation/baseType'),
  AnythingType = require('../../../../../lib/api/core/validation/types/anything'),
  should = require('should');

describe('Test: validation/types/anything', () => {
  it('should derivate from BaseType', () => {
    var anythingType = new AnythingType();

    should(BaseType.prototype.isPrototypeOf(anythingType)).be.true();
  });

  it('should construct properly', () => {
    var anythingType = new AnythingType();

    should(typeof anythingType.typeName).be.eql('string');
    should(typeof anythingType.allowChildren).be.eql('boolean');
    should(Array.isArray(anythingType.allowedTypeOptions)).be.true();
    should(anythingType.typeName).be.eql('anything');
    should(anythingType.allowChildren).be.false();
  });

  it('should override functions properly',() => {
    should(typeof AnythingType.prototype.validate).be.eql('function');
    should(typeof AnythingType.prototype.validateFieldSpecification).be.eql('function');
  });

  describe('#validate', () => {
    it('should always return true', () => {
      var anythingType = new AnythingType();

      should(anythingType.validate()).be.true();
    });
  });

  describe('#validateFieldSpecification', () => {
    it('should always return true', () => {
      var anythingType = new AnythingType();

      should(anythingType.validateFieldSpecification()).be.true();
    });
  });
});
