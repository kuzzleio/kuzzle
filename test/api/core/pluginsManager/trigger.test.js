var
  /** @type {Params} */
  params = require('rc')('kuzzle'),
  rewire = require('rewire'),
  PluginsManager = rewire('../../../../lib/api/core/plugins/pluginsManager'),
  EventEmitter = require('eventemitter2').EventEmitter2;

describe('Test plugins manager trigger', function () {
  before(function () {
    PluginsManager.__set__('console', {log: function () {}, error: function () {}});
  });

  it('should trigger hooks event', function (done) {
    var
      kuzzle = new EventEmitter({
        wildcard: true,
        maxListeners: 30,
        delimiter: ':'
      }),
      pluginsManager;

    kuzzle.config = {pluginsManager: params.pluginsManager};

    pluginsManager = new PluginsManager(kuzzle);

    pluginsManager.plugins = [{
      object: {
        init: function () {},
        hooks: {
          'foo:*': 'myFunc'
        },
        myFunc: function () {
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
