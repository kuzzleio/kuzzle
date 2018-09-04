const
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  PluginsManager = require('../../../../lib/api/core/plugins/pluginsManager');

describe('Test plugins manager trigger', () => {
  it('should trigger hooks with wildcard event', function (done) {
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
