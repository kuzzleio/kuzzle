const
  should = require('should'),
  errorsManager = require('../../lib/config/error-codes/throw'),
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

describe('#throw', () => {
  it('should throw an ExternalServiceError with right name, msg and code', () => {
    should(() => errorsManager.throw('api', 'server', 'elasticsearch_down', '{"status":"red"}'))
      .throw(
        ExternalServiceError,
        {
          errorName: 'api.server.elasticsearch_down',
          code: parseInt('02020001', 16),
          message: 'ElasticSearch is down: {"status":"red"}.'
        }
      );
  });

  it('should throw an InternalError with default name, msg and code', () => {
    should(() => errorsManager.throw('api', 'server', 'fake_error', '{"status":"error"}'))
      .throw(
        InternalError,
        {
          errorName: 'internal.unexpected.unknown_error',
          code: parseInt('00000001', 16),
          message: 'Unknown error: {"status":"error"}.'
        }
      );
  });

  it('should throw an NotFoundError with default name, msg and code', () => {
    should(() => errorsManager.throw('api', 'admin', 'database_not_found', 'fake_database'))
      .throw(
        NotFoundError,
        {
          errorName: 'api.admin.database_not_found',
          code: parseInt('02040001', 16),
          message: 'Database fake_database not found.'
        }
      );
  });

  it('should throw a PreconditionError with default name, msg and code', () => {
    should(() => errorsManager.throw('api', 'admin', 'action_locked', 'Kuzzle is already shutting down'))
      .throw(
        PreconditionError,
        {
          errorName: 'api.admin.action_locked',
          code: parseInt('02040002', 16),
          message: 'Lock action error: Kuzzle is already shutting down.'
        }
      );
  });

  it('should throw an UnauthorizedError with default name, msg and code', () => {
    should(() => errorsManager.throw('api', 'auth', 'invalid_token'))
      .throw(
        UnauthorizedError,
        {
          errorName: 'api.auth.invalid_token',
          code: parseInt('02050002', 16),
          message: 'Invalid token.'
        }
      );
  });

  it('should throw a PartialError with default name, msg and code', () => {
    should(() => errorsManager.throw('api', 'bulk', 'document_creations_failed', ['foo', 'bar']))
      .throw(
        PartialError,
        {
          errorName: 'api.bulk.document_creations_failed',
          errors: ['foo', 'bar'],
          code: parseInt('02080001', 16),
          message: 'Some document creations failed: foo,bar.'
        }
      );
  });
});
