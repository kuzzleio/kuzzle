'use strict';

const should = require('should');

const { PreconditionError } = require('../../../../index');
const BaseType = require('../../../../lib/core/validation/baseType');
const UrlType = require('../../../../lib/core/validation/types/url');

describe('Test: validation/types/url', () => {
  const urlType = new UrlType();

  it('should inherit the BaseType class', () => {
    should(urlType).be.instanceOf(BaseType);
  });

  it('should construct properly', () => {
    should(typeof urlType.typeName).be.eql('string');
    should(typeof urlType.allowChildren).be.eql('boolean');
    should(Array.isArray(urlType.allowedTypeOptions)).be.true();
    should(urlType.typeName).be.eql('url');
    should(urlType.allowChildren).be.false();
  });

  describe('#validate', () => {
    it('should return true if the value is valid', () => {
      should(urlType.validate({notEmpty: true}, 'http://www.domain.com/', [])).be.true();
    });

    it('should return true if the value is empty and optional', () => {
      should(urlType.validate({notEmpty: false}, '', [])).be.true();
    });

    it('should return false if the value is empty and required', () => {
      const errorMessage = [];

      should(urlType.validate({notEmpty: true}, '', errorMessage)).be.false();
      should(errorMessage).be.deepEqual(['The string must not be empty.']);
    });

    it('should return false if the value is not a valid URL address', () => {
      var errorMessage = [];

      should(urlType.validate({notEmpty: true}, 'not an url address', errorMessage)).be.false();
      should(errorMessage).be.deepEqual(['The string must be a valid URL.']);
    });

    it('should return false if the value is not a string', () => {
      [[], {}, 123, undefined, null, false].forEach(v => {
        const errorMessage = [];

        should(urlType.validate({notEmpty: true}, v, errorMessage)).be.false();
        should(errorMessage).be.deepEqual(['The field must be a string.']);
      });
    });
  });

  describe('#validateFieldSpecification', () => {
    it('should return a defaulted typeOptions object if none is provided', () => {
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

    it('should throw if notEmpty is not set properly', () => {
      [[], {}, 'foo', 123, undefined, null].forEach(v => {
        should(() => urlType.validateFieldSpecification({notEmpty: v}))
          .throw(PreconditionError, { id: 'validation.assert.invalid_type' });
      });
    });
  });
});
