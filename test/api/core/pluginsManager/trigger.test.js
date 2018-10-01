const
  mockrequire = require('mock-require'),
  ElasticsearchClientMock = require('../../../mocks/services/elasticsearchClient.mock'),
  KuzzleMock = require('../../../mocks/kuzzle.mock');


describe('Test plugins manager trigger', () => {
  it('should trigger hooks with wildcard event', function (done) {
    mockrequire('elasticsearch', {Client: ElasticsearchClientMock});
    mockrequire.reRequire('../../../../lib/services/internalEngine');
    mockrequire.reRequire('../../../../lib/api/core/plugins/pluginContext');
    mockrequire.reRequire('../../../../lib/api/core/plugins/privilegedPluginContext');
    const PluginsManager = mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');

    const
      kuzzle = new KuzzleMock(),
      pluginsManager = new PluginsManager(kuzzle);

    pluginsManager.plugins = [{
      object: {
        init: () => {},
        hooks: {
          'foo:*': 'myFunc'
        },
        myFunc: () => {
          done();
        }
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

});
