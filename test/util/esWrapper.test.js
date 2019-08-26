'use strict';

const
  should = require('should'),
  {
    errors: {
      ExternalServiceError,
      NotFoundError
    }
  } = require('kuzzle-common-objects'),
  ESClientMock = require('../mocks/services/elasticsearchClient.mock'),
  ESWrapper = require('../../lib/util/esWrapper');

describe('Test: ElasticSearch Wrapper', () => {
  const
    client = new ESClientMock(),
    esWrapper = new ESWrapper(client);

  describe('#formatESError', () => {
    it('should convert any unknown error to a ExternalServiceError instance', () => {
      const error = new Error('test');
      error.meta = {
        statusCode: 420
      };

      const formatted = esWrapper.formatESError(error);

      should(formatted).be.instanceOf(ExternalServiceError);
      should(formatted.errorName).be.eql('external.elasticsearch.unexpected_error');
    });

    it('should handle version conflict errors', () => {
      const error = new Error('[version_conflict_engine_exception] [data][AVrbg0eg90VMe4Z_dG8j]: version conflict, current version [153] is different than the one provided [152], with { index_uuid="iDrU6CfZSO6CghM1t6dl0A" & shard="2" & index="userglobaldata" }');
      error.meta = {
        statusCode: 409
      };

      const formatted = esWrapper.formatESError(error);

      should(formatted).be.instanceOf(ExternalServiceError);
      should(formatted.errorName).be.eql('external.elasticsearch.unexpected_conflict_error');
    });
  });


  describe('#getMapping', () => {
    const
      mappingRequest = {index: 'foo', type: 'bar'};

    it('should allow users to retrieve a mapping', () => {
      const mappings = {
        bar: { properties: {} }
      };

      client.indices.getMapping.resolves({ body: { nepali: { mappings } } });

      return esWrapper.getMapping(mappingRequest)
        .then(result => {
          should(result.nepali).not.be.undefined();
          should(result.nepali.mappings).not.be.undefined();
        });
    });

    it('should exclude attribute `_kuzzle_info` from the returned mapping', () => {
      const
        mappings = {
          bar: {
            properties: {
              foo: 'bar',
              _kuzzle_info: {
                it: 'should',
                not: 'be',
                exposed: ['to', 'the', 'final', 'client']
              }
            }
          }
        };

      client.indices.getMapping.resolves({ body: { foo: { mappings } } });

      return esWrapper.getMapping(mappingRequest)
        .then(result => {
          should(result.foo.mappings.bar.properties).match({foo: 'bar'});
          should(result.foo.mappings.bar.properties._kuzzle_info).be.undefined();
        });
    });

    it('should return a rejected promise if there is no mapping found', async () => {
      client.indices.getMapping.resolves({
        body: {
          foobar: {
            mappings: {qux: {
              properties: {foo: 'bar'}
            }}
          }
        }
      });

      return should(esWrapper.getMapping(mappingRequest))
        .be.rejectedWith(
          NotFoundError,
          {message: `No mapping found for index "${mappingRequest.index}".`})
        .then(() => {
          client.indices.getMapping.resolves({
            body: {
              foo: {
                mappings: {foobar: {
                  properties: {foo: 'bar'}
                }}
              }
            }
          });

          return should(esWrapper.getMapping(mappingRequest)).be.rejectedWith(
            NotFoundError,
            {message: `No mapping found for index "${mappingRequest.index}".`});
        });
    });

    it('should reject the getMapping promise if elasticsearch throws an error', () => {
      const error = new Error('Mocked error');
      error.meta = {
        statusCode: 420
      };
      client.indices.getMapping.rejects(error);

      return should(esWrapper.getMapping(mappingRequest))
        .be.rejectedWith(ExternalServiceError, {
          errorName: 'external.elasticsearch.unexpected_error' });
    });

    it('should include attribute `_kuzzle_info` when includeKuzzleMeta is true', () => {
      const
        mappings = {
          bar: { properties: {
            foo: 'bar',
            _kuzzle_info: { kuzzle: 'meta', data: 'mapping' }
          }}
        };

      client.indices.getMapping.resolves({ body: { foo: { mappings } } });

      return esWrapper.getMapping(mappingRequest, true)
        .then(result => {
          should(result.foo.mappings.bar.properties).match({foo: 'bar'});
          should(result.foo.mappings.bar.properties._kuzzle_info)
            .not.be.undefined()
            .be.eql(mappings.bar.properties._kuzzle_info);
        });
    });

    it('should handle multi-indexes responses (can happen on index aliases)', () => {
      const mappings = {
        bar: {
          properties: {
            foo: 'bar',
            _kuzzle_info: 'foobar'
          }
        }
      };

      client.indices.getMapping.resolves({
        body: {
          foo: { mappings },
          bar: { mappings },
          baz: { mappings }
        }
      });

      return esWrapper.getMapping({index: 'alias', type: 'bar'}, true)
        .then(result => {
          for (const index of ['foo', 'bar', 'baz']) {
            should(result[index].mappings.bar.properties).match({foo: 'bar'});
            should(result[index].mappings.bar.properties._kuzzle_info)
              .not.be.undefined()
              .be.eql(mappings.bar.properties._kuzzle_info);
          }
        });
    });

    it('should filter unrelated collections from multi-indexes responses', () => {
      const mappings = {
        bar: {
          properties: {
            foo: 'bar',
            _kuzzle_info: 'foobar'
          }
        },
        qux: {
          properties: {
            foo: 'bar'
          }
        }
      };

      client.indices.getMapping.resolves({
        body: {
          foo: { mappings },
          bar: { mappings },
          baz: { mappings }
        }
      });

      return esWrapper.getMapping({index: 'alias', type: 'bar'}, true)
        .then(result => {
          for (const index of ['foo', 'bar', 'baz']) {
            should(result[index].mappings.bar.properties).match({foo: 'bar'});
            should(result[index].mappings.bar.properties._kuzzle_info)
              .not.be.undefined()
              .be.eql(mappings.bar.properties._kuzzle_info);
            should(result[index].mappings.qux).be.undefined();
          }
        });
    });

    it('should skip empty indexes without mappings', () => {
      client.indices.getMapping.resolves({
        body: {
          foo: {},
          qux: { mappings: { bar: { properties: {} } } }
        }
      });

      return esWrapper.getMapping({index: 'alias', type: 'bar'}, true)
        .then(result => {
          should(result).be.an.Object().and.eql({
            qux: { mappings: { bar: { properties: {} } } }
          });
        });
    });

    it('should accept indices containing a dot', () => {
      client.indices.getMapping.resolves({
        '.foo.bar': {
          mappings: {
            foo: { properties: {} }
          }
        }
      });

      return esWrapper.getMapping()
        .then(result => {
          should(result).match({
            '.foo.bar': {
              mappings: {
                foo: { properties: {} }
              }
            }
          });
        });
    });
  });
});
