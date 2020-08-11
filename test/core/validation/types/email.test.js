'use strict';

const
  { PreconditionError } = require('kuzzle-common-objects'),
  BaseType = require('../../../../lib/core/validation/baseType'),
  EmailType = require('../../../../lib/core/validation/types/email'),
  should = require('should');

describe('Test: validation/types/email', () => {
  const emailType = new EmailType();

  it('should derivate from BaseType', () => {
    should(emailType).be.instanceOf(BaseType);
  });

  it('should construct properly', () => {
    should(typeof emailType.typeName).be.eql('string');
    should(typeof emailType.allowChildren).be.eql('boolean');
    should(Array.isArray(emailType.allowedTypeOptions)).be.true();
    should(emailType.typeName).be.eql('email');
    should(emailType.allowChildren).be.false();
  });

  describe('#validate', () => {
    it('should return true if the provided email is valid', () => {
      should(emailType.validate({notEmpty: true}, 'user@domain.com', [])).be.true();
    });

    it('should return true if email is optional and no email is provided', () => {
      should(emailType.validate({notEmpty: false}, '', [])).be.true();
      should(emailType.validate({notEmpty: false}, undefined, [])).be.true();
      should(emailType.validate({notEmpty: false}, null, [])).be.true();
    });

    it('should return false if no email is provided and if an email is required', () => {
      const errorMessage = [];

      should(emailType.validate({notEmpty: true}, '', errorMessage)).be.false();
      should(errorMessage).be.deepEqual(['The string must not be empty.']);

      errorMessage.shift();
      should(emailType.validate({notEmpty: true}, undefined, errorMessage)).be.false();
      should(errorMessage).be.deepEqual(['Field cannot be undefined or null']);

      errorMessage.shift();
      should(emailType.validate({notEmpty: true}, null, errorMessage)).be.false();
      should(errorMessage).be.deepEqual(['Field cannot be undefined or null']);
    });

    it('should return false if the value is not valid', () => {
      const errorMessage = [];

      should(emailType.validate({notEmpty: true}, 'not an email', errorMessage)).be.false();
      should(errorMessage).be.deepEqual(['The string must be a valid email address.']);
    });

    it('should return false if the value is not valid', () => {
      var errorMessage = [];

      should(emailType.validate({notEmpty: true}, {not: 'a string'}, errorMessage)).be.false();
      should(errorMessage).be.deepEqual(['The field must be a string.']);
    });
  });


  describe('#validateFieldSpecification', () => {
    it('should return defaulted typeOptions if properties are missing', () => {
      should(emailType.validateFieldSpecification({})).be.deepEqual({
        notEmpty: false
      });
    });

    it('should return the same typeOptions if it is valid', () => {
      should(emailType.validateFieldSpecification({
        notEmpty: true
      })).be.deepEqual({
        notEmpty: true
      });
    });

    it('should throw if the provided "notEmpty" option is invalid', () => {
      should(() => emailType.validateFieldSpecification({notEmpty: 'foobar'}))
        .throw(PreconditionError, { id: 'validation.assert.invalid_type' });
    });
  });
});
