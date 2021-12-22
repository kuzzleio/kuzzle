'use strict';

const mockRequire = require('mock-require');
const should = require('should');
const sinon = require('sinon');
const { merge } = require('lodash');

const { InternalError: KuzzleInternalError } = require('../../index');
const defaultConfig = require('../../lib/config/default.config');

function getcfg (cfg) {
  const defaults = JSON.parse(JSON.stringify(defaultConfig));

  return merge(defaults.default, cfg);
}

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

  describe('#processRedisOptions', () => {
    it('should use old database option and put it in redis client options when provided', async () => {
      mockedConfigContent = {
        services: {
          internalCache: {
            node: { host: 'foobar', port: 6379 },
            database: 4
          },
          memoryStorage: {
            node: { host: 'foobar', port: 6379 },
            database: 4
          },
        }
      };

      const result = config.loadConfig();

      should(result.services.internalCache.options.db).be.eql(4);
      should(result.services.memoryStorage.options.db).be.eql(4);
    });
  });

  describe('#load', () => {
    it('should invoke "rc" to load both the default and custom configs', () => {
      config.loadConfig();

      should(rcMock).calledOnce().calledWith('kuzzle', defaultConfig.default);
    });

    it('should return an intelligible error when unable to parse the configuration file', () => {
      const err = new Error('foo');
      rcMock.throws(err);

      should(() => config.loadConfig()).throw(KuzzleInternalError, {
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

      const result = config.loadConfig();

      should(result.version).be.exactly(require('../../package.json').version);
      should(result.someVersion).be.exactly('1');
      should(result.anotherVersion).be.exactly('false');
    });

    it('should convert bools', () => {
      mockedConfigContent = {
        bar: 'false',
        foo: 'true',
      };

      const result = config.loadConfig();

      should(result.foo).be.true();
      should(result.bar).be.false();
    });

    it('should convert numbers', () => {
      mockedConfigContent = {
        bar: '0.25',
        foo: '42',
      };

      const result = config.loadConfig();

      should(result.foo).be.exactly(42);
      should(result.bar).be.exactly(0.25);
    });

    it('should convert JSON strings', () => {
      mockedConfigContent = {
        bar: '*json:["foo", null, 123, 123.45, true]',
        baz: '*json:{"this": { "goes": ["to", 11] } }',
      };

      const result = config.loadConfig();

      should(result.bar).match(['foo', null, 123, 123.45, true]);
      should(result.baz).match({this: { goes: [ 'to', 11 ] } });
    });

    it('should throw if an invalid JSON string is provided for parsing', () => {
      mockedConfigContent = {
        foo: '*json:{ ahah: "I am using teh internet", nothing = to see here}',
      };

      should(() => config.loadConfig()).throw({
        id: 'core.configuration.cannot_parse',
        message: /the key "foo" does not contain a valid stringified JSON/,
      });
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

      const result = config.loadConfig();

      should(result.foo).be.exactly(42);
      should(result.nested.bar).be.true();
      should(result.nested.sub.baz).be.false();
    });
  });

  describe('#checkLimits', () => {
    it('should throw if an invalid limits configuration is submitted', () => {
      mockedConfigContent = { limits: true };

      should(() => config.loadConfig())
        .throw(KuzzleInternalError, { id: 'core.configuration.invalid_type' });


      mockedConfigContent = { limits: ['foo', 'bar'] };
      should(() => config.loadConfig())
        .throw(KuzzleInternalError, { id: 'core.configuration.invalid_type' });
    });

    it('should throw on negative limit values', () => {
      for (const limit of Object.keys(defaultConfig.default.limits).filter(l => l !== 'requestsRate')) {
        mockedConfigContent = getcfg({
          limits: {
            [limit]: -1
          }
        });
        /* eslint-disable-next-line no-loop-func -- false positive */
        should(() => config.loadConfig())
          .throw(KuzzleInternalError, { id: 'core.configuration.out_of_range' });
      }
    });

    it('should throw on 0-valued limits except for special cases', () => {
      const canBeZero = [
        'subscriptionMinterms',
        'subscriptionRooms',
        'subscriptionDocumentTTL'
      ];

      for (const limit of Object.keys(defaultConfig.default.limits).filter(l => l !== 'requestsRate')) {
        mockedConfigContent = getcfg({
          limits: {
            [limit]: 0
          }
        });

        if (canBeZero.includes(limit)) {
          /* eslint-disable-next-line no-loop-func -- false positive */
          const result = config.loadConfig();
          should(result.limits[limit]).be.eql(0);
        }
        else {
          /* eslint-disable-next-line no-loop-func -- false positive */
          should(() => config.loadConfig())
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

      should(() => config.loadConfig())
        .throw(KuzzleInternalError, { id: 'core.configuration.out_of_range' });

      mockedConfigContent = getcfg({
        limits: {
          concurrentRequests: 1234,
          requestsBufferSize: 1234,
        }
      });
      should(() => config.loadConfig())
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

      should(() => config.loadConfig())
        .throw(KuzzleInternalError, { id: 'core.configuration.out_of_range' });

      mockedConfigContent = getcfg({
        limits: {
          concurrentRequests: 50,
          requestsBufferSize: 100,
          requestsBufferWarningThreshold: 101,
        }
      });
      should(() => config.loadConfig())
        .throw(KuzzleInternalError, { id: 'core.configuration.out_of_range' });
    });
  });

  describe('#checkHttpOptions', () => {

    it('should throw if "accessControlAllowOrigin" is not an array or a string', () => {
      for (const bad of [null, 123, 0, true] ) {
        mockedConfigContent = getcfg({
          http: {
            accessControlAllowOrigin: bad
          }
        });

        // eslint-disable-next-line no-loop-func
        should(() => config.loadConfig())
          .throw(`[http] "accessControlAllowOrigin" parameter: invalid value "${bad}" (array or string expected)`);
      }
    });

    it('should throw if "enabled" is not a boolean', () => {
      for (const bad of [null, 'foo', 123, 0, [], {}] ) {
        mockedConfigContent = getcfg({
          server: {
            protocols: {
              http: {
                enabled: bad,
              }
            }
          }
        });

        // eslint-disable-next-line no-loop-func
        should(() => config.loadConfig())
          .throw(`[http] "enabled" parameter: invalid value "${bad}" (boolean expected)`);
      }
    });

    it('should throw if "allowCompression" is not a boolean', async () => {
      for (const bad of [null, 'foo', 123, 0, [], {}] ) {
        mockedConfigContent = getcfg({
          server: {
            protocols: {
              http: {
                allowCompression: bad,
              }
            }
          }
        });

        // eslint-disable-next-line no-loop-func
        should(() => config.loadConfig())
          .throw(`[http] "allowCompression" parameter: invalid value "${bad}" (boolean expected)`);
      }
    });

    it('should throw if "maxEncodingLayers" holds an invalid value', async () => {
      for (const bad of [null, 'foo', 0, true, [], {}]) {
        mockedConfigContent = getcfg({
          server: {
            protocols: {
              http: {
                maxEncodingLayers: bad,
              }
            }
          }
        });

        // eslint-disable-next-line no-loop-func
        should(() => config.loadConfig())
          .throw(`[http] "maxEncodingLayers" parameter: invalid value "${bad}" (integer >= 1 expected)`);
      }
    });

    it('should throw if "maxFormFileSize" holds an invalid value', async () => {
      for (const bad of [null, -1, true, [], {}, 'foobar']) {
        mockedConfigContent = getcfg({
          server: {
            protocols: {
              http: {
                maxFormFileSize: bad,
              }
            }
          }
        });

        // eslint-disable-next-line no-loop-func
        should(() => config.loadConfig())
          .throw(`[http] "maxFormFileSize" parameter: cannot parse "${bad}"`);
      }
    });
  });

  describe('#checkWebSocketOptions', () => {
    it('should throw if "enabled" is not a boolean', async () => {
      for (const bad of [null, 'foo', 123, 0, [], {}] ) {
        mockedConfigContent = getcfg({
          server: {
            protocols: {
              websocket: {
                enabled: bad,
              }
            }
          }
        });

        // eslint-disable-next-line no-loop-func
        should(() => config.loadConfig())
          .throw(`[websocket] "enabled" parameter: invalid value "${bad}" (boolean expected)`);
      }
    });

    it('should throw if "idleTimeout" holds an invalid value', async () => {
      for (const bad of [null, 'foo', -1, [], {}, true]) {
        mockedConfigContent = getcfg({
          server: {
            protocols: {
              websocket: {
                idleTimeout: bad,
              }
            }
          }
        });

        // eslint-disable-next-line no-loop-func
        should(() => config.loadConfig())
          .throw(`[websocket] "idleTimeout" parameter: invalid value "${bad}" (integer >= 1000 expected)`);
      }
    });

    it('should throw if "compression" holds an invalid value', async () => {
      for (const bad of [null, 'foo', 123, 0, [], {}] ) {
        mockedConfigContent = getcfg({
          server: {
            protocols: {
              websocket: {
                compression: bad,
              }
            }
          }
        });

        // eslint-disable-next-line no-loop-func
        should(() => config.loadConfig())
          .throw(`[websocket] "compression" parameter: invalid value "${bad}" (boolean value expected)`);
      }
    });

    it('should throw if "rateLimit" holds an invalid value', async () => {
      for (const bad of [null, 'foo', -1, [], {}, true]) {
        mockedConfigContent = getcfg({
          server: {
            protocols: {
              websocket: {
                rateLimit: bad,
              }
            }
          }
        });

        // eslint-disable-next-line no-loop-func
        should(() => config.loadConfig())
          .throw(`[websocket] "rateLimit" parameter: invalid value "${bad}" (integer >= 0 expected)`);
      }
    });
  });

  describe('#preprocessHttpOptions', async () => {
    it('should convert string separated coma to an array for accessControlAllowOrigin', () => {
      mockedConfigContent = getcfg({
        http: {
          accessControlAllowOrigin: 'foo, bar'
        }
      });

      config.loadConfig();

      should(mockedConfigContent.http.accessControlAllowOrigin).be.eql([
        'foo',
        'bar'
      ]);
    });

    it('should set internal allowAllOrigins to true if * is present in accessControlAllowOrigin', () => {
      mockedConfigContent = getcfg({
        http: {
          accessControlAllowOrigin: 'foo, bar, *'
        }
      });

      const cfg = config.loadConfig();

      should(cfg.http.accessControlAllowOrigin).be.eql([
        'foo',
        'bar',
        '*'
      ]);
      should(cfg.internal.allowAllOrigins).be.true();
    });
  });
});
