var
  BaseType = require('../../../../../lib/api/core/validation/baseType'),
  UrlType = require('../../../../../lib/api/core/validation/types/url'),
  should = require('should');

describe('Test: validation/types/url', () => {
  var urlType = new UrlType();

  it('should derivate from BaseType', () => {
    should(BaseType.prototype.isPrototypeOf(urlType)).be.true();
  });

  it('should construct properly', () => {
    should(typeof urlType.typeName).be.eql('string');
    should(typeof urlType.allowChildren).be.eql('boolean');
    should(Array.isArray(urlType.allowedTypeOptions)).be.true();
    should(urlType.typeName).be.eql('url');
    should(urlType.allowChildren).be.false();
  });

  it('should override functions properly',() => {
    should(typeof UrlType.prototype.validate).be.eql('function');
    should(typeof UrlType.prototype.validateFieldSpecification).be.eql('function');
  });

  describe('#validate', () => {
    it('should return true if the value is valid', () => {
      should(urlType.validate({notEmpty: true}, 'http://www.domain.com/', [])).be.true();
    });

    it('should return true if the value is valid', () => {
      should(urlType.validate({notEmpty: false}, '', [])).be.true();
    });

    it('should return false if the value is not valid', () => {
      var errorMessage = [];

      should(urlType.validate({notEmpty: true}, '', errorMessage)).be.false();
      should(errorMessage).be.deepEqual(['The string must not be empty.']);
    });

    it('should return false if the value is not valid', () => {
      var errorMessage = [];

      should(urlType.validate({notEmpty: true}, 'not an ip address', errorMessage)).be.false();
      should(errorMessage).be.deepEqual(['The string must be a valid URL.']);
    });

    it('should return false if the value is not valid', () => {
      var errorMessage = [];

      should(urlType.validate({notEmpty: true}, {not: 'a string'}, errorMessage)).be.false();
      should(errorMessage).be.deepEqual(['The field must be a string.']);
    });
  });

  describe('#validateFieldSpecification', () => {
    it('should return default typeOptions if there is no typeOptions', () => {
      should(urlType.validateFieldSpecification({})).be.deepEqual({
        notEmpty: false
      });
    });

    it('should return the same typeOptions if it is set properly', () => {
      should(urlType.validateFieldSpecification({
        notEmpty: true
      })).be.deepEqual({
        notEmpty: true
      });
    });

    it('should return false if notEmpty is not set properly', () => {
      should(urlType.validateFieldSpecification({
        notEmpty: 'not proper'
      })).be.false();
    });
  });
});
