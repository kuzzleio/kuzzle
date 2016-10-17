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
    should(emailType.typeName).be.eql('email');
    should(emailType.allowChildren).be.false();
  });

  it('should override functions properly',() => {
    should(typeof EmailType.prototype.validate).be.eql('function');
    should(typeof EmailType.prototype.validateFieldSpecification).be.eql('function');
  });

  describe('#validate', () => {
    var emailType = new EmailType();

    it('should return true if the value is valid', () => {
      should(emailType.validate({notEmpty: true}, 'user@domain.com', [])).be.true();
    });

    it('should return true if the value is valid', () => {
      should(emailType.validate({notEmpty: false}, '', [])).be.true();
    });

    it('should return false if the value is not valid', () => {
      var errorMessage = [];

      should(emailType.validate({notEmpty: true}, '', errorMessage)).be.false();
      should(errorMessage).be.deepEqual(['The string must not be empty.']);
    });

    it('should return false if the value is not valid', () => {
      var errorMessage = [];

      should(emailType.validate({notEmpty: true}, 'not an email', errorMessage)).be.false();
      should(errorMessage).be.deepEqual(['The string must be a valid email address.']);
    });

    it('should return false if the value is not valid', () => {
      var errorMessage = [];

      should(emailType.validate({notEmpty: true}, {not: 'a string'}, errorMessage)).be.false();
      should(errorMessage).be.deepEqual(['The field must be a string.']);
    });
  });


  describe('#validateFieldSpecification', () => {
    var emailType = new EmailType();

    it('should return default typeOptions if there is no typeOptions', () => {
      should(emailType.validateFieldSpecification({})).be.deepEqual({
        notEmpty: false
      });
    });

    it('should return the same typeOptions if it is set properly', () => {
      should(emailType.validateFieldSpecification({
        notEmpty: true
      })).be.deepEqual({
        notEmpty: true
      });
    });

    it('should return false if notEmpty is not set properly', () => {
      should(emailType.validateFieldSpecification({
        notEmpty: 'not proper'
      })).be.false();
    });
  });
});
