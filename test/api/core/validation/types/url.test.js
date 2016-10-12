var
  BaseType = require('../../../../../lib/api/core/validation/baseType'),
  UrlType = require('../../../../../lib/api/core/validation/types/url'),
  should = require('should');

describe('Test: validation/types/url', () => {
  it('should derivate from BaseType', () => {
    var urlType = new UrlType();

    should(BaseType.prototype.isPrototypeOf(urlType)).be.true();
  });

  it('should construct properly', () => {
    var urlType = new UrlType();

    should(typeof urlType.typeName).be.eql('string');
    should(typeof urlType.allowChildren).be.eql('boolean');
    should(Array.isArray(urlType.allowedTypeOptions)).be.true();
  });

  it('should override functions properly',() => {
    should(typeof UrlType.prototype.validate).be.eql('function');
    should(typeof UrlType.prototype.validateFieldSpecification).be.eql('function');
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
