'use strict';

const should = require('should');
const { ExternalServiceError } = require('kuzzle-common-objects');

const ESClientMock = require('../../mocks/service/elasticsearchClient.mock');
const KuzzleMock = require('../../mocks/kuzzle.mock');

const ESWrapper = require('../../../lib/service/storage/esWrapper');

describe('Test: ElasticSearch Wrapper', () => {
  const kuzzle = new KuzzleMock();
  const client = new ESClientMock();
  const esWrapper = new ESWrapper(client, kuzzle);

  describe('#formatESError', () => {
    it('should convert any unknown error to a ExternalServiceError instance', () => {
      const error = new Error('test');
      error.meta = {
        statusCode: 420
      };

      const formatted = esWrapper.formatESError(error);

      should(formatted).be.instanceOf(ExternalServiceError);
      should(formatted.id).be.eql('services.storage.unexpected_error');
    });

    it('should handle version conflict errors', () => {
      const error = new Error('[version_conflict_engine_exception] [data][AVrbg0eg90VMe4Z_dG8j]: version conflict, current version [153] is different than the one provided [152], with { index_uuid="iDrU6CfZSO6CghM1t6dl0A" & shard="2" & index="userglobaldata" }');
      error.meta = {
        statusCode: 409
      };

      const formatted = esWrapper.formatESError(error);

      should(formatted).be.instanceOf(ExternalServiceError);
      should(formatted.id).be.eql('services.storage.too_many_changes');
    });

    it('should handle already existing document', () => {
      const error = new Error('');
      error.meta = { body: { error: { reason: '[liia]: version conflict, document already exists (current version [1])' } } };

      const formatted = esWrapper.formatESError(error);

      should(formatted).be.match({
        id: 'services.storage.document_already_exists'
      });
    });

    it('should handle document not found', () => {
      const error = new Error('test');
      error.meta = { statusCode: 404 };
      error.body = {
        _index: '&nyc-open-data.yellow-taxi',
        found: false,
        _id: 'mehry',
        error: {
          reason: 'foo',
          'resource.id': 'bar'
        }
      };

      const formatted = esWrapper.formatESError(error);

      should(formatted).be.match({
        message: 'Document "mehry" not found in "nyc-open-data":"yellow-taxi".',
        id: 'services.storage.not_found'
      });
    });

    describe('logging in production', () => {
      let nodeEnv;

      beforeEach(() => {
        nodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
      });

      afterEach(() => {
        process.env.NODE_ENV = nodeEnv;
      });

      it('should log the source error for easier support & debugging', () => {
        kuzzle.log.info.resetHistory();

        const error = new Error('test');
        error.meta = {
          statusCode: 420,
          meta: {
            request: {
              oh: 'noes',
            }
          }
        };

        esWrapper.formatESError(error);

        should(kuzzle.log.info).be.calledWith(JSON.stringify({
          message: `Elasticsearch Client error: ${error.message}`,
          meta: error.meta,
          stack: error.stack,
        }));
      });

      it('should be able to log errors without meta', () => {
        kuzzle.log.info.resetHistory();

        const error = new Error('test');

        esWrapper.formatESError(error);

        should(kuzzle.log.info).be.calledWith(JSON.stringify({
          message: `Elasticsearch Client error: ${error.message}`,
          meta: null,
          stack: error.stack,
        }));
      });
    });
  });
});
