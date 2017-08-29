'use strict';

const
  should = require('should'),
  {
    ExternalServiceError,
  } = require('kuzzle-common-objects').errors,
  ESCommon = require('../../lib/util/esCommon');

describe('Test: ElasticSearch common utils', () => {
  describe('#formatESError', () => {
    it('should convert any unknown error to a ExternalServiceError instance', () => {
      const
        error = new Error('test');

      error.displayName = 'foobar';

      const formatted = ESCommon.formatESError(error);

      should(formatted).be.instanceOf(ExternalServiceError);
      should(formatted.message).be.eql('test');
    });
  });

  it('should handle version conflict errors', () => {
    const error = new Error('[version_conflict_engine_exception] [data][AVrbg0eg90VMe4Z_dG8j]: version conflict, current version [153] is different than the one provided [152], with { index_uuid="iDrU6CfZSO6CghM1t6dl0A" & shard="2" & index="userglobaldata" }');

    error.displayName = 'Conflict';

    const formatted = ESCommon.formatESError(error);

    should(formatted).be.instanceOf(ExternalServiceError);
    should(formatted.message).be.eql('Unable to modify document "AVrbg0eg90VMe4Z_dG8j": cluster sync failed (too many simultaneous changes applied)');
  });
});
