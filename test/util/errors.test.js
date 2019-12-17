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
  it('should return an ExternalServiceError with right name, msg and code', () => {
    const err = errorsManager.get('core', 'fatal', 'service_unavailable', '{"status":"red"}');
    should(err).be.instanceOf(ExternalServiceError);
    should(err).match({
      id: 'core.fatal.service_unavailable',
      code: parseInt('00000002', 16),
      message: 'Service unavailable: {"status":"red"}.'
    });
  });

  it('should allow to override original message', () => {
    const err = errorsManager.get(
      'core',
      'fatal',
      'service_unavailable',
      'Lambda Core',
      { message: 'Anomalous Materials' });

    should(err).be.instanceOf(ExternalServiceError);
    should(err).match({
      id: 'core.fatal.service_unavailable',
      code: parseInt('00000002', 16),
      message: 'Anomalous Materials'
    });
  });

  it('should return an InternalError with default name, msg and code', () => {
    const err = errorsManager.get('api', 'assert', 'fake_error', '{"status":"error"}');
    should(err).be.instanceOf(InternalError);
    should(err).match({
      id: 'core.fatal.unexpected_error',
      code: parseInt('00000001', 16),
      message: 'Caught an unexpected error: {"status":"error"}.'
    });
  });

  it('should return a NotFoundError with default name, msg and code', () => {
    const err = errorsManager.get('services', 'storage', 'not_found', 'fake_id');
    should(err).be.instanceOf(NotFoundError);
    should(err).match({
      id: 'services.storage.not_found',
      code: parseInt('0101000b', 16),
      message: 'Document "fake_id" not found.'
    });
  });

  it('should return a PreconditionError with default name, msg and code', () => {
    const err = errorsManager.get('services', 'storage', 'unknown_index', 'foo');
    should(err).be.instanceOf(PreconditionError);
    should(err).match({
      id: 'services.storage.unknown_index',
      code: parseInt('01010001', 16),
      message: 'The index "foo" does not exist.'
    });
  });

  it('should return an UnauthorizedError with default name, msg and code', () => {
    const err = errorsManager.get('security', 'token', 'invalid');
    should(err).be.instanceOf(UnauthorizedError);
    should(err).match({
      id: 'security.token.invalid',
      code: parseInt('07010001', 16),
      message: 'Invalid token.'
    });
  });

  it('should return a PartialError with default name, msg and code', () => {
    const err = errorsManager.get('services', 'storage', 'import_failed', ['foo', 'bar']);

    should(err).be.instanceOf(PartialError);
    should(err).match({
      id: 'services.storage.import_failed',
      errors: ['foo', 'bar'],
      count: 2,
      code: parseInt('01010005', 16),
      message: 'Failed to import some or all documents.'
    });
  });
});
