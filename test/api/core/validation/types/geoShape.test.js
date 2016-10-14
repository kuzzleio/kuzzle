var
  BaseType = require('../../../../../lib/api/core/validation/baseType'),
  GeoShapeType = require('../../../../../lib/api/core/validation/types/geoShape'),
  should = require('should');

describe('Test: validation/types/geoShape', () => {
  var geoShapeType = new GeoShapeType();

  it('should derivate from BaseType', () => {
    should(BaseType.prototype.isPrototypeOf(geoShapeType)).be.true();
  });

  it('should construct properly', () => {
    should(typeof geoShapeType.typeName).be.eql('string');
    should(typeof geoShapeType.allowChildren).be.eql('boolean');
    should(Array.isArray(geoShapeType.allowedTypeOptions)).be.true();
    should(geoShapeType.typeName).be.eql('geo_shape');
    should(geoShapeType.allowChildren).be.false();
  });

  it('should override functions properly',() => {
    should(typeof GeoShapeType.prototype.validate).be.eql('function');
    should(typeof GeoShapeType.prototype.validateFieldSpecification).be.eql('function');
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
