var
  should = require('should'),
  Kuzzle = require.main.require('lib/api/kuzzle');

describe('Test main file for hooks managers', () => {
  var
    kuzzle,
    badHooksConfig = {
      'foo:bar': ['foo:bar'],
      'foo:baz': ['foo:bar', 'foo:baz']
    },
    hooksConfig = {
      'data:beforeCreate': ['publish:add'],
      'data:beforeCreateOrReplace': ['publish:add']
    };

  beforeEach(() => {
    kuzzle = new Kuzzle();
    kuzzle.removeAllListeners();
  });

  it('should be rejected on init when a hook is undefined in config', () => {
    var pInit;

    kuzzle.config = {
      hooks: badHooksConfig
    };
    pInit = kuzzle.hooks.init();

    return should(pInit).be.rejected();
  });

  it('should be resolve when the config is valid', () => {
    var pInit;

    kuzzle.config = {
      hooks: hooksConfig
    };
    pInit = kuzzle.hooks.init();

    return should(pInit).be.fulfilled();
  });

  it('should attach event and trigger corresponding function according to config file', () => {
    kuzzle.config = {
      hooks: hooksConfig
    };
    kuzzle.hooks.init();

    should(kuzzle.hooks.list).have.property('publish');
    should(kuzzle.hooks.list.publish).be.an.Object();

    should(kuzzle.listeners('data:beforeCreate')).be.an.Array();
    should(kuzzle.listeners('data:beforeCreate').length).be.exactly(1);
    should(kuzzle.listeners('data:beforeCreateOrReplace')).be.an.Array();
    should(kuzzle.listeners('data:beforeCreateOrReplace').length).be.exactly(1);

    should(kuzzle.listeners('data:beforeCreate')[0]).be.a.Function();
    should(kuzzle.listeners('data:beforeCreateOrReplace')[0]).be.a.Function();

  });
});
