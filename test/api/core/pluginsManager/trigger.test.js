const
  /** @type {Params} */
  params = require('../../../../lib/config'),
  PluginsManager = require('../../../../lib/api/core/plugins/pluginsManager'),
  EventEmitter = require('eventemitter2').EventEmitter2;

describe('Test plugins manager trigger', () => {
  it('should trigger hooks with wildcard event', function (done) {
    let
      kuzzle = new EventEmitter({
        verboseMemoryLeak: true,
        wildcard: true,
        maxListeners: 30,
        delimiter: ':'
      }),
      pluginsManager;

    kuzzle.config = {plugins: params.plugins};

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
      activated: true
    }];

    pluginsManager.run()
      .then(() => {
        pluginsManager.trigger('foo:bar');
      });
  });

});
