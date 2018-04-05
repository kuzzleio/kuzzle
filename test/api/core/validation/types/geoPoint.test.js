var
  rewire = require('rewire'),
  BaseType = require('../../../../../lib/api/core/validation/baseType'),
  GeoPointType = rewire('../../../../../lib/api/core/validation/types/geoPoint'),
  sinon = require('sinon'),
  should = require('should');

describe('Test: validation/types/geoPoint', () => {
  var
    geoPointType = new GeoPointType(),
    sandbox = sinon.sandbox.create();

  beforeEach(() => {
    sandbox.resetHistory();
  });

  it('should derivate from BaseType', () => {
    should(BaseType.prototype.isPrototypeOf(geoPointType)).be.true();
  });

  it('should construct properly', () => {
    should(typeof geoPointType.typeName).be.eql('string');
    should(typeof geoPointType.allowChildren).be.eql('boolean');
    should(Array.isArray(geoPointType.allowedTypeOptions)).be.true();
    should(geoPointType.typeName).be.eql('geo_point');
    should(geoPointType.allowChildren).be.false();
  });

  it('should override functions properly',() => {
    should(typeof GeoPointType.prototype.validate).be.eql('function');
    should(typeof GeoPointType.prototype.validateFieldSpecification).be.eql('function');
  });

  describe('#validate', () => {
    var
      convertGeopointStub = sandbox.stub();

    GeoPointType.__set__('convertGeopoint', convertGeopointStub);

    it('should return true if the geoPoint is valid', () => {
      convertGeopointStub.returns(true);
      should(geoPointType.validate({}, {lat: 25.2, lon: 17.3}), []).be.true();
    });

    it('should return false if the geoPoint is not valid', () => {
      var errorMessages = [];

      convertGeopointStub.returns(null);
      should(geoPointType.validate({}, {not: 'a geopoint'}, errorMessages)).be.false();
      should(errorMessages).be.deepEqual(['Invalid GeoPoint format']);
    });
  });

  describe('#validateFieldSpecification', () => {
    it('should always return true', () => {
      should(geoPointType.validateFieldSpecification()).be.true();
    });
  });
});
