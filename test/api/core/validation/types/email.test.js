var
  BaseType = require('../../../../../lib/api/core/validation/baseType'),
  EmailType = require('../../../../../lib/api/core/validation/types/email'),
  should = require('should');

describe('Test: validation/types/email', () => {
  it('should derivate from BaseType', () => {
    var emailType = new EmailType();

    should(BaseType.prototype.isPrototypeOf(emailType)).be.true();
  });

  it('should construct properly', () => {
    var emailType = new EmailType();

    should(typeof emailType.typeName).be.eql('string');
    should(typeof emailType.allowChildren).be.eql('boolean');
    should(Array.isArray(emailType.allowedTypeOptions)).be.true();
  });

  it('should override functions properly',() => {
    should(typeof EmailType.prototype.validate).be.eql('function');
    should(typeof EmailType.prototype.validateFieldSpecification).be.eql('function');
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
