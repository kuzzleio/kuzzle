const
  mockrequire = require('mock-require'),
  should = require('should'),
  ElasticsearchClientMock = require('../../../mocks/services/elasticsearchClient.mock'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  {
    errors: {
      PluginImplementationError
    }
  } = require('kuzzle-common-objects');

describe('Test plugins manager trigger', () => {
  let pluginsManager;

  beforeEach(() => {
    mockrequire('elasticsearch', {Client: ElasticsearchClientMock});
    mockrequire.reRequire('../../../../lib/services/internalEngine');
    mockrequire.reRequire('../../../../lib/api/core/plugins/pluginContext');
    mockrequire.reRequire('../../../../lib/api/core/plugins/privilegedPluginContext');
    const PluginsManager = mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');

    pluginsManager = new PluginsManager(new KuzzleMock());
  });

  it('should trigger hooks with wildcard event', done => {
    pluginsManager.plugins = [{
      object: {
        init: () => {},
        hooks: {
          'foo:*': 'myFunc'
        },
        myFunc: done
      },
      config: {},
      activated: true,
      manifest: {
        name: 'foo'
      }
    }];

    pluginsManager.run()
      .then(() => {
        pluginsManager.trigger('foo:bar');
      });
  });

  it('should reject a pipe returned value if it is not a Request instance', () => {
    const pluginMock = {
      object: {
        init: () => {},
        pipes: {
          'foo:bar': 'myFunc'
        },
        myFunc: () => {
          throw new Error('foobar');
        }
      },
      config: {},
      activated: true,
      manifest: {
        name: 'foo'
      }
    };

    pluginsManager.object = [pluginMock];

    pluginsManager.registerPipe(pluginMock, 50, 200, 'foo:bar', 'myFunc');

    return should(pluginsManager.trigger('foo:bar')).rejectedWith(
      PluginImplementationError,
      {message: /^Plugin foo pipe for event 'foo:bar' threw a non-Kuzzle error: Error: foobar.*/});
  });
});
