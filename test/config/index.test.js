'use strict';

const
  rewire = require('rewire'),
  should = require('should'),
  Config = rewire('../../lib/config'),
  defaultConfig = require('../../lib/config/default.config'),
  {
    InternalError: KuzzleInternalError
  } = require('kuzzle-common-objects');

describe('lib/config/index.js', () => {
  describe('#unstringify', () => {
    const unstringify = Config.__get__('unstringify');

    it('should keep versions as string', () => {
      const config = unstringify({
        version: '0',
        someVersion: '1'
      });

      should(config.version).be.exactly('0');
      should(config.someVersion).be.exactly('1');
    });

    it('should convert bools', () => {
      const config = unstringify({
        foo: 'true',
        bar: 'false'
      });

      should(config.foo).be.true();
      should(config.bar).be.false();
    });

    it('should convert numbers', () => {
      const config = unstringify({
        foo: '42',
        bar: '0.25'
      });

      should(config.foo).be.exactly(42);
      should(config.bar).be.exactly(0.25);
    });

    it('should be recursive', () => {
      const config = unstringify({
        foo: '42',
        nested: {
          bar: 'true',
          sub: {
            baz: 'false'
          }
        }
      });

      should(config.foo).be.exactly(42);
      should(config.nested.bar).be.true();
      should(config.nested.sub.baz).be.false();
    });
  });

  describe('#checkLimits', () => {
    const
      checkLimits = Config.__get__('checkLimitsConfig'),
      // checkLimits normally receives a defaulted version of Kuzzle configuration
      getcfg = config => {
        const defaults = JSON.parse(JSON.stringify(defaultConfig.limits));

        config.limits = Object.assign(defaults, config.limits);

        return config;
      };

    it('should throw if an invalid limits configuration is submitted', () => {
      should(() => checkLimits({limits: true}))
        .throw(KuzzleInternalError, { id: 'core.configuration.invalid_type' });

      should(() => checkLimits({limits: ['foo', 'bar']}))
        .throw(KuzzleInternalError, { id: 'core.configuration.invalid_type' });
    });

    it('should throw on negative limit values', () => {
      for (const limit of Object.keys(defaultConfig.limits).filter(l => l !== 'requestsRate')) {
        const config = getcfg({
          limits: {
            [limit]: -1
          }
        });

        should(() => checkLimits(config))
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
        const config = getcfg({
          limits: {
            [limit]: 0
          }
        });

        if (canBeZero.includes(limit)) {
          should(() => checkLimits(config)).not.throw();
          should(config.limits[limit]).be.eql(0);
        }
        else {
          should(() => checkLimits(config))
            .throw(KuzzleInternalError, { id: 'core.configuration.out_of_range' });
        }
      }
    });

    it('should throw if the concurrentRequests limit is outside its allowed range', () => {
      const config = getcfg({
        limits: {
          concurrentRequests: 1234,
          requestsBufferSize: 456
        }
      });

      should(() => checkLimits(config))
        .throw(KuzzleInternalError, { id: 'core.configuration.out_of_range' });

      config.limits.concurrentRequests = config.limits.requestsBufferSize;
      should(() => checkLimits(config))
        .throw(KuzzleInternalError, { id: 'core.configuration.out_of_range' });
    });

    it('should throw on an invalid buffer limit threshold warning configuration', () => {
      const config = getcfg({
        limits: {
          concurrentRequests: 50,
          requestsBufferSize: 100,
          requestsBufferWarningThreshold: 1
        }
      });

      should(() => checkLimits(config))
        .throw(KuzzleInternalError, { id: 'core.configuration.out_of_range' });

      config.limits.requestsBufferWarningThreshold = 101;
      should(() => checkLimits(config))
        .throw(KuzzleInternalError, { id: 'core.configuration.out_of_range' });
    });
  });
});
