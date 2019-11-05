const
  should = require('should'),
  errorsManager = require('../../lib/util/errors'),
  {
    errors: {
      InternalError,
      ExternalServiceError,
      NotFoundError,
      PreconditionError,
      PartialError,
      UnauthorizedError
    }
  } = require('kuzzle-common-objects');

describe('#errorsManager', () => {
  it('should throw an ExternalServiceError with right name, msg and code', () => {
    should(() => errorsManager.throw('core', 'fatal', 'service_unavailable', '{"status":"red"}'))
      .throw(
        ExternalServiceError,
        {
          errorName: 'core.fatal.service_unavailable',
          code: parseInt('00000002', 16),
          message: 'Service unavailable: {"status":"red"}.'
        }
      );
  });

  it('should throw an InternalError with default name, msg and code', () => {
    should(() => errorsManager.throw('api', 'assert', 'fake_error', '{"status":"error"}'))
      .throw(
        InternalError,
        {
          errorName: 'core.fatal.unexpected_error',
          code: parseInt('00000001', 16),
          message: 'Caught an unexpected error: {"status":"error"}.'
        }
      );
  });

  it('should throw an NotFoundError with default name, msg and code', () => {
    should(() => errorsManager.throw('services', 'storage', 'not_found', 'fake_id'))
      .throw(
        NotFoundError,
        {
          errorName: 'services.storage.not_found',
          code: parseInt('0101000b', 16),
          message: 'Document "fake_id" not found.'
        }
      );
  });

  it('should throw a PreconditionError with default name, msg and code', () => {
    should(() => errorsManager.throw('services', 'storage', 'unknown_index', 'foo'))
      .throw(
        PreconditionError,
        {
          errorName: 'services.storage.unknown_index',
          code: parseInt('01010001', 16),
          message: 'The index "foo" does not exist.'
        }
      );
  });

  it('should throw an UnauthorizedError with default name, msg and code', () => {
    should(() => errorsManager.throw('security', 'token', 'invalid'))
      .throw(
        UnauthorizedError,
        {
          errorName: 'security.token.invalid',
          code: parseInt('07010001', 16),
          message: 'Invalid token.'
        }
      );
  });

  it('should throw a PartialError with default name, msg and code', () => {
    should(() => errorsManager.throw('services', 'storage', 'import_failed', ['foo', 'bar']))
      .throw(
        PartialError,
        {
          errorName: 'services.storage.import_failed',
          errors: ['foo', 'bar'],
          count: 2,
          code: parseInt('01010005', 16),
          message: 'Failed to import some or all documents.'
        }
      );
  });
});
