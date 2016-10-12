var
  BaseType = require('../../../../../lib/api/core/validation/baseType'),
  GeoPointType = require('../../../../../lib/api/core/validation/types/geoPoint'),
  should = require('should');

describe('Test: validation/types/geoPoint', () => {
  it('should derivate from BaseType', () => {
    var geoPointType = new GeoPointType();

    should(BaseType.prototype.isPrototypeOf(geoPointType)).be.true();
  });

  it('should construct properly', () => {
    var geoPointType = new GeoPointType();

    should(typeof geoPointType.typeName).be.eql('string');
    should(typeof geoPointType.allowChildren).be.eql('boolean');
    should(Array.isArray(geoPointType.allowedTypeOptions)).be.true();
  });

  it('should override functions properly',() => {
    should(typeof GeoPointType.prototype.validate).be.eql('function');
    should(typeof GeoPointType.prototype.validateFieldSpecification).be.eql('function');
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
