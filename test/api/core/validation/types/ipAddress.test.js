var
  BaseType = require('../../../../../lib/api/core/validation/baseType'),
  IpAddressType = require('../../../../../lib/api/core/validation/types/ipAddress'),
  should = require('should');

describe('Test: validation/types/ipAddress', () => {
  var ipAddressType = new IpAddressType();

  it('should derivate from BaseType', () => {
    should(BaseType.prototype.isPrototypeOf(ipAddressType)).be.true();
  });

  it('should construct properly', () => {
    should(typeof ipAddressType.typeName).be.eql('string');
    should(typeof ipAddressType.allowChildren).be.eql('boolean');
    should(Array.isArray(ipAddressType.allowedTypeOptions)).be.true();
    should(ipAddressType.typeName).be.eql('ip_address');
    should(ipAddressType.allowChildren).be.false();
  });

  it('should override functions properly',() => {
    should(typeof IpAddressType.prototype.validate).be.eql('function');
    should(typeof IpAddressType.prototype.validateFieldSpecification).be.eql('function');
  });

  describe('#validate', () => {
    it('should return true if the value is valid', () => {
      should(ipAddressType.validate({notEmpty: true}, '127.0.0.1', [])).be.true();
    });

    it('should return true if the value is valid', () => {
      should(ipAddressType.validate({notEmpty: false}, '', [])).be.true();
    });

    it('should return false if the value is not valid', () => {
      var errorMessage = [];

      should(ipAddressType.validate({notEmpty: true}, '', errorMessage)).be.false();
      should(errorMessage).be.deepEqual(['The string must not be empty.']);
    });

    it('should return false if the value is not valid', () => {
      var errorMessage = [];

      should(ipAddressType.validate({notEmpty: true}, 'not an ip address', errorMessage)).be.false();
      should(errorMessage).be.deepEqual(['The string must be a valid IP address.']);
    });

    it('should return false if the value is not valid', () => {
      var errorMessage = [];

      should(ipAddressType.validate({notEmpty: true}, {not: 'a string'}, errorMessage)).be.false();
      should(errorMessage).be.deepEqual(['The field must be a string.']);
    });
  });

  describe('#validateFieldSpecification', () => {
    var ipAddressType = new IpAddressType();

    it('should return default typeOptions if there is no typeOptions', () => {
      should(ipAddressType.validateFieldSpecification({})).be.deepEqual({
        notEmpty: false
      });
    });

    it('should return the same typeOptions if it is set properly', () => {
      should(ipAddressType.validateFieldSpecification({
        notEmpty: true
      })).be.deepEqual({
        notEmpty: true
      });
    });

    it('should return false if notEmpty is not set properly', () => {
      should(ipAddressType.validateFieldSpecification({
        notEmpty: 'not proper'
      })).be.false();
    });
  });
});
