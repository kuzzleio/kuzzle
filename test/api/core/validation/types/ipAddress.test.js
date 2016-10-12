var
  IpAddressType = require('../../../../../lib/api/core/validation/baseType'),
  AnythingType = require('../../../../../lib/api/core/validation/types/ipAddress'),
  should = require('should');

describe('Test: validation/types/ipAddress', () => {
  it('should derivate from BaseType', () => {
    var ipAddressType = new AnythingType();

    should(IpAddressType.prototype.isPrototypeOf(ipAddressType)).be.true();
  });

  it('should construct properly', () => {
    var ipAddressType = new AnythingType();

    should(typeof ipAddressType.typeName).be.eql('string');
    should(typeof ipAddressType.allowChildren).be.eql('boolean');
    should(Array.isArray(ipAddressType.allowedTypeOptions)).be.true();
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
