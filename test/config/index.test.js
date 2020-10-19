'use strict';

const mockRequire = require('mock-require');
const should = require('should');
const sinon = require('sinon');
const { InternalError: KuzzleInternalError } = require('kuzzle-common-objects');

const defaultConfig = require('../../lib/config/default.config');

describe('lib/config/index.js', () => {
  let config;
  let rcMock;
  let mockedConfigContent;

  beforeEach(() => {
    rcMock = sinon.stub().callsFake(function (_, defcfg) {
      return Object.assign({}, defcfg, mockedConfigContent);
    });

    mockedConfigContent = null;

    mockRequire('rc', rcMock);
    config = mockRequire.reRequire('../../lib/config');
  });

  afterEach(() => {
    mockRequire.stopAll();
    mockRequire.reRequire('../../lib/config');
  });

  describe('#loadConfig', () => {
    it('should invoke "rc" to load both the default and custom configs', () => {
      config.load();

      should(rcMock).calledOnce().calledWith('kuzzle', defaultConfig);
    });

    it('should return an intelligible error when unable to parse the configuration file', () => {
      const err = new Error('foo');
      rcMock.throws(err);

      should(() => config.load()).throw(KuzzleInternalError, {
        id: 'core.configuration.cannot_parse',
        message: 'Unable to read kuzzlerc configuration file: foo',
      });
    });
  });

  describe('#unstringify', () => {
    it('should keep versions as string', () => {
      mockedConfigContent = {
        someVersion: '1',
        anotherVersion: 'false',
      };

      const result = config.load();

      should(result.version).be.exactly(require('../../package.json').version);
      should(result.someVersion).be.exactly('1');
      should(result.anotherVersion).be.exactly('false');
    });

    it('should convert bools', () => {
      mockedConfigContent = {
        bar: 'false',
        foo: 'true',
      };

      const result = config.load();

      should(result.foo).be.true();
      should(result.bar).be.false();
    });

    it('should convert numbers', () => {
      mockedConfigContent = {
        bar: '0.25',
        foo: '42',
      };

      const result = config.load();

      should(result.foo).be.exactly(42);
      should(result.bar).be.exactly(0.25);
    });

    it('should be recursive', () => {
      mockedConfigContent = {
        foo: '42',
        nested: {
          bar: 'true',
          sub: {
            baz: 'false',
          },
        },
      };

      const result = config.load();

      should(result.foo).be.exactly(42);
      should(result.nested.bar).be.true();
      should(result.nested.sub.baz).be.false();
    });
  });

  describe('#checkLimits', () => {
    // checkLimits normally receives a defaulted version of Kuzzle configuration
    const getcfg = cfg => {
      const defaults = JSON.parse(JSON.stringify(defaultConfig.limits));

      cfg.limits = Object.assign(defaults, cfg.limits);

      return cfg;
    };

    it('should throw if an invalid limits configuration is submitted', () => {
      mockedConfigContent = { limits: true };

      should(() => config.load())
        .throw(KuzzleInternalError, { id: 'core.configuration.invalid_type' });


      mockedConfigContent = { limits: ['foo', 'bar'] };
      should(() => config.load())
        .throw(KuzzleInternalError, { id: 'core.configuration.invalid_type' });
    });

    it('should throw on negative limit values', () => {
      for (const limit of Object.keys(defaultConfig.limits).filter(l => l !== 'requestsRate')) {
        mockedConfigContent = getcfg({
          limits: {
            [limit]: -1
          }
        });

        /* eslint-disable-next-line no-loop-func -- false positive */
        should(() => config.load())
          .throw(KuzzleInternalError, { id: 'core.configuration.out_of_range' });
      }
    });

    it('should throw on 0-valued limits except for special cases', () => {
      const canBeZero = [
        'subscriptionMinterms',
        'subscriptionRooms',
        'subscriptionDocumentTTL'
      ];

      for (const limit of Object.keys(defaultConfig.limits).filter(l => l !== 'requestsRate')) {
        mockedConfigContent = getcfg({
          limits: {
            [limit]: 0
          }
        });

        if (canBeZero.includes(limit)) {
          /* eslint-disable-next-line no-loop-func -- false positive */
          const result = config.load();
          should(result.limits[limit]).be.eql(0);
        }
        else {
          /* eslint-disable-next-line no-loop-func -- false positive */
          should(() => config.load())
            .throw(KuzzleInternalError, { id: 'core.configuration.out_of_range' });
        }
      }
    });

    it('should throw if the concurrentRequests limit is outside its allowed range', () => {
      mockedConfigContent = getcfg({
        limits: {
          concurrentRequests: 1234,
          requestsBufferSize: 456,
        }
      });

      should(() => config.load())
        .throw(KuzzleInternalError, { id: 'core.configuration.out_of_range' });

      mockedConfigContent = getcfg({
        limits: {
          concurrentRequests: 1234,
          requestsBufferSize: 1234,
        }
      });
      should(() => config.load())
        .throw(KuzzleInternalError, { id: 'core.configuration.out_of_range' });
    });

    it('should throw on an invalid buffer limit threshold warning configuration', () => {
      mockedConfigContent = getcfg({
        limits: {
          concurrentRequests: 50,
          requestsBufferSize: 100,
          requestsBufferWarningThreshold: 1,
        }
      });

      should(() => config.load())
        .throw(KuzzleInternalError, { id: 'core.configuration.out_of_range' });

      mockedConfigContent = getcfg({
        limits: {
          concurrentRequests: 50,
          requestsBufferSize: 100,
          requestsBufferWarningThreshold: 101,
        }
      });
      should(() => config.load())
        .throw(KuzzleInternalError, { id: 'core.configuration.out_of_range' });
    });
  });
});
