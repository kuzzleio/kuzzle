var
  BaseType = require('../../../../../lib/api/core/validation/baseType'),
  DateType = require('../../../../../lib/api/core/validation/types/date'),
  should = require('should');

describe('Test: validation/types/date', () => {
  it('should derivate from BaseType', () => {
    var dateType = new DateType();

    should(BaseType.prototype.isPrototypeOf(dateType)).be.true();
  });

  it('should construct properly', () => {
    var dateType = new DateType();

    should(typeof dateType.typeName).be.eql('string');
    should(typeof dateType.allowChildren).be.eql('boolean');
    should(Array.isArray(dateType.allowedTypeOptions)).be.true();
    should(dateType.typeName).be.eql('date');
    should(dateType.allowChildren).be.false();
  });

  it('should override functions properly',() => {
    should(typeof DateType.prototype.validate).be.eql('function');
    should(typeof DateType.prototype.validateFieldSpecification).be.eql('function');
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
