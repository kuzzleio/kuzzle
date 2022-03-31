'use strict';

const should = require('should');

const BaseType = require('../../../../lib/core/validation/baseType');
const IpAddressType = require('../../../../lib/core/validation/types/ipAddress');
const { PreconditionError } = require('../../../../index');

describe('Test: validation/types/ipAddress', () => {
  const ipAddressType = new IpAddressType();

  it('should inherit the BaseType class', () => {
    should(ipAddressType).be.instanceOf(BaseType);
  });

  it('should construct properly', () => {
    should(typeof ipAddressType.typeName).be.eql('string');
    should(typeof ipAddressType.allowChildren).be.eql('boolean');
    should(Array.isArray(ipAddressType.allowedTypeOptions)).be.true();
    should(ipAddressType.typeName).be.eql('ip_address');
    should(ipAddressType.allowChildren).be.false();
  });

  describe('#validate', () => {
    it('should return true if the value is a valid IPv4 address', () => {
      should(ipAddressType.validate({ notEmpty: true }, '127.0.0.1', [])).be.true();
    });

    it('should return true if the value is a valid IPv6 address', () => {
      should(ipAddressType.validate({ notEmpty: true }, '::1', [])).be.true();
      should(ipAddressType.validate({ notEmpty: true }, '2001:db8::1', [])).be.true();
    });

    it('should return true if no address is provided and if it is optional', () => {
      should(ipAddressType.validate({ notEmpty: false }, '', [])).be.true();
    });

    it('should return false if no address is provided while being required', () => {
      const errorMessage = [];

      should(ipAddressType.validate({ notEmpty: true }, '', errorMessage)).be.false();
      should(errorMessage).be.deepEqual(['The string must not be empty.']);
    });

    it('should return false if the value is not a valid IP address', () => {
      ['foobar', '1.2.3.256', '2001:dg8::1'].forEach(ip => {
        const errorMessage = [];

        should(ipAddressType.validate({ notEmpty: true }, ip, errorMessage)).be.false();
        should(errorMessage).be.deepEqual(['The string must be a valid IP address.']);
      });
    });

    it('should return false if the value is not a string', () => {
      [[], {}, null, undefined, 123].forEach(v => {
        const errorMessage = [];

        should(ipAddressType.validate({ notEmpty: true }, v, errorMessage)).be.false();
        should(errorMessage).be.deepEqual(['The field must be a string.']);
      });
    });
  });

  describe('#validateFieldSpecification', () => {
    it('should return a defaulted typeOptions object if none is provided', () => {
      should(ipAddressType.validateFieldSpecification({})).be.deepEqual({
        notEmpty: false
      });
    });

    it('should not change a typeOptions object if a valid one is provided', () => {
      should(ipAddressType.validateFieldSpecification({
        notEmpty: true
      })).be.deepEqual({
        notEmpty: true
      });
    });

    it('should throw if "notEmpty" is not set properly', () => {
      should(() => ipAddressType.validateFieldSpecification({ notEmpty: null }))
        .throw(PreconditionError, { id: 'validation.assert.invalid_type' });
    });
  });
});
