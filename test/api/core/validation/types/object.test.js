var
  BaseType = require('../../../../../lib/api/core/validation/baseType'),
  ObjectType = require('../../../../../lib/api/core/validation/types/object'),
  should = require('should');

describe('Test: validation/types/object', () => {
  it('should derivate from BaseType', () => {
    var objectType = new ObjectType();

    should(BaseType.prototype.isPrototypeOf(objectType)).be.true();
  });

  it('should construct properly', () => {
    var objectType = new ObjectType();

    should(typeof objectType.typeName).be.eql('string');
    should(typeof objectType.allowChildren).be.eql('boolean');
    should(Array.isArray(objectType.allowedTypeOptions)).be.true();
  });

  it('should override functions properly',() => {
    should(typeof ObjectType.prototype.validate).be.eql('function');
    should(typeof ObjectType.prototype.validateFieldSpecification).be.eql('function');
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
