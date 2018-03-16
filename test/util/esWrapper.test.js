'use strict';

const
  Bluebird = require('bluebird'),
  should = require('should'),
  {
    ExternalServiceError,
  } = require('kuzzle-common-objects').errors,
  ESClientMock = require('../mocks/services/elasticsearchClient.mock'),
  ESWrapper = require('../../lib/util/esWrapper');

describe('Test: ElasticSearch Wrapper', () => {
  const
    client = new ESClientMock(),
    esWrapper = new ESWrapper(client);

  describe('#formatESError', () => {
    it('should convert any unknown error to a ExternalServiceError instance', () => {
      const
        error = new Error('test');

      error.displayName = 'foobar';

      const formatted = esWrapper.formatESError(error);

      should(formatted).be.instanceOf(ExternalServiceError);
      should(formatted.message).be.eql('test');
    });
  });

  it('should handle version conflict errors', () => {
    const error = new Error('[version_conflict_engine_exception] [data][AVrbg0eg90VMe4Z_dG8j]: version conflict, current version [153] is different than the one provided [152], with { index_uuid="iDrU6CfZSO6CghM1t6dl0A" & shard="2" & index="userglobaldata" }');

    error.displayName = 'Conflict';

    const formatted = esWrapper.formatESError(error);

    should(formatted).be.instanceOf(ExternalServiceError);
    should(formatted.message).be.eql('Unable to modify document "AVrbg0eg90VMe4Z_dG8j": cluster sync failed (too many simultaneous changes applied)');
  });

  describe('#getMapping', () => {
    const
      mappingRequest = {index: 'foo', type: 'bar'};

    it('should allow users to retrieve a mapping', () => {
      const
        mappings = {
          bar: {properties: {}}
        };

      client.indices.getMapping.returns(Bluebird.resolve({foo: {mappings}}));

      return esWrapper.getMapping(mappingRequest)
        .then(result => {
          should(result.foo).not.be.undefined();
          should(result.foo.mappings).not.be.undefined();
        });
    });

    it('should allow exclude attribute `_kuzzle_info` from the returned mapping', () => {
      const
        mappings = {
          bar: {properties: {
            foo: 'bar',
            _kuzzle_info: {it: 'should', not: 'be', exposed: ['to', 'the', 'final', 'client']}
          }}
        };

      client.indices.getMapping.returns(Bluebird.resolve({foo: {mappings}}));

      return esWrapper.getMapping(mappingRequest)
        .then(result => {
          should(result.foo.mappings.bar.properties).match({foo: 'bar'});
          should(result.foo.mappings.bar.properties._kuzzle_info).be.undefined();
        });
    });

    it('should return a rejected promise if there is no mapping found', () => {
      client.indices.getMapping.returns(Bluebird.resolve({
        foobar: {
          mappings: {bar: {
            propeties: {foo: 'bar'}
          }}
        }
      }));
      should(esWrapper.getMapping(mappingRequest)).be.rejected();

      client.indices.getMapping.returns(Bluebird.resolve({
        foo: {
          mappings: {foobar: {
            propeties: {foo: 'bar'}
          }}
        }
      }));
      should(esWrapper.getMapping(mappingRequest)).be.rejected();
    });

    it('should reject the getMapping promise if elasticsearch throws an error', () => {
      const error = new Error('Mocked error');
      client.indices.getMapping.rejects(error);

      return should(esWrapper.getMapping(mappingRequest)).be.rejectedWith(ExternalServiceError, {message: error.message});
    });
  });
});
