'use strict';

const
  BaseType = require('../../../../lib/core/validation/baseType'),
  GeoPointType = require('../../../../lib/core/validation/types/geoPoint'),
  should = require('should');

describe('Test: validation/types/geoPoint', () => {
  const geoPointType = new GeoPointType();

  it('should inherit the BaseType class', () => {
    should(geoPointType).be.instanceOf(BaseType);
  });

  it('should construct properly', () => {
    should(typeof geoPointType.typeName).be.eql('string');
    should(typeof geoPointType.allowChildren).be.eql('boolean');
    should(Array.isArray(geoPointType.allowedTypeOptions)).be.true();
    should(geoPointType.typeName).be.eql('geo_point');
    should(geoPointType.allowChildren).be.false();
  });

  describe('#validate', () => {
    it('should return true if the geoPoint is valid', () => {
      should(geoPointType.validate({}, { lat: 25.2, lon: 17.3 }), []).be.true();
    });

    it('should return false if the geoPoint is not valid', () => {
      const errorMessages = [];

      should(geoPointType.validate({}, { not: 'a geopoint' }, errorMessages)).be.false();
      should(errorMessages).be.deepEqual(['Invalid GeoPoint format']);
    });
  });
});
