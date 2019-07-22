const
  PreconditionError = require('kuzzle-common-objects').errors.PreconditionError,
  BaseType = require('../../../../../lib/api/core/validation/baseType'),
  StringType = require('../../../../../lib/api/core/validation/types/string'),
  should = require('should');

describe('Test: validation/types/string', () => {
  const stringType = new StringType();

  it('should inherit the BaseType class', () => {
    should(stringType).be.instanceOf(BaseType);
  });

  it('should construct properly', () => {
    should(typeof stringType.typeName).be.eql('string');
    should(typeof stringType.allowChildren).be.eql('boolean');
    should(Array.isArray(stringType.allowedTypeOptions)).be.true();
    should(stringType.typeName).be.eql('string');
    should(stringType.allowChildren).be.false();
  });

  describe('#validate', () => {
    it('should return true if the value is valid', () => {
      should(stringType.validate({}, 'a string', [])).be.true();
    });

    it('should return true if the string length is comprised in the provided length range', () => {
      should(stringType.validate({length: {min:7, max: 9}}, 'a string', [])).be.true();
    });

    it('should return false if the value is not a string', () => {
      [[], {}, 123, null, undefined].forEach(v => {
        const errorMessage = [];

        should(stringType.validate({}, v, errorMessage)).be.false();
        should(errorMessage).be.deepEqual(['The field must be a string.']);
      });
    });

    it('should return false if the value length is below the expected minimum', () => {
      const errorMessage = [];

      should(stringType.validate({length: {min: 10}}, 'a string', errorMessage)).be.false();
      should(errorMessage).be.deepEqual(['Invalid string length. Expected min: 10. Received: 8 ("a string")']);
    });

    it('should return false if the value length is above the expected maximum', () => {
      const errorMessage = [];

      should(stringType.validate({length: {max: 5}}, 'a string', errorMessage)).be.false();
      should(errorMessage).be.deepEqual(['Invalid string length. Expected max: 5. Received: 8 ("a string")']);
    });
  });

  describe('#validateFieldSpecification', () => {
    it('should validate the typeOptions object is set properly', () => {
      const opts = {
        length: {
          min: 41,
          max: 42
        }
      };

      should(stringType.validateFieldSpecification(opts)).be.eql(opts);
    });

    it('should throw if "length" is not an object', () => {
      [[], undefined, null, 'foobar', 123].forEach(length => {
        should(() => stringType.validateFieldSpecification({length}))
          .throw(PreconditionError, {message: 'Invalid "length" option definition.'});
      });
    });

    it('should throw if an unrecognized property is passed to the length options', () => {
      should(() => stringType.validateFieldSpecification({length: {foo: 123}}))
        .throw(PreconditionError, {message: 'Invalid "length" option definition.'});
    });

    it('should throw if a non-numeric value is passed to the min or max properties', () => {
      [[], {}, undefined, null, 'foo'].forEach(v => {
        should(() => stringType.validateFieldSpecification({length: {min: v}}))
          .throw(PreconditionError, {message: 'Invalid "length.min" option: must be of type "number".'});

        should(() => stringType.validateFieldSpecification({length: {max: v}}))
          .throw(PreconditionError, {message: 'Invalid "length.max" option: must be of type "number".'});
      });
    });

    it('should throw if min is greater than max', () => {
      should(() => stringType.validateFieldSpecification({
        length: {
          min: 42,
          max: 41
        }
      })).throw(PreconditionError, {message: 'Invalid length range: min > max.'});
    });
  });
});
