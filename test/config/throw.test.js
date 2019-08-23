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
          code: '02020001',
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
          code: '00000001',
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
          code: '02040001',
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
          code: '02040002',
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
          code: '02050002',
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
          code: '02080001',
          message: 'Some document creations failed: foo,bar.'
        }
      );
  });
});
