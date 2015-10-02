var
  should = require('should'),
  rewire = require('rewire'),
  PluginsManager = rewire('../../../../lib/api/core/pluginsManager');

describe('Test plugins manager installation', function () {

  var installPlugins;

  before(function () {
    PluginsManager.__set__('initConfig', function () {});
    PluginsManager.__set__('npmInstall', function () {});
    PluginsManager.__set__('kuzzle', {log: {info: function () {}, error: function () {}}});
    installPlugins = PluginsManager.__get__('installPlugins');
  });

  it('should return false if there is no plugins', function () {
    should(installPlugins([])).be.false();
  });

  it('should return true if there is plugin to install with url', function () {
    var plugins = {
      foo: {
        url: 'bar'
      }
    };

    PluginsManager.__set__('needInstall', function () {return true;});
    should(installPlugins(plugins)).be.true();
  });

  it('should return true if there is plugin to install with name and version', function () {
    var plugins = {
      foo: {
        version: 3
      }
    };

    PluginsManager.__set__('needInstall', function () {return true;});
    should(installPlugins(plugins)).be.true();
  });

  it('should return false if there is plugin but without url and version', function () {
    var plugins = {
      foo: {
        bar: 'qux'
      }
    };

    PluginsManager.__set__('needInstall', function () {return true;});
    should(installPlugins(plugins)).be.false();
  });

  it('should return false if there is plugin but already installed', function () {
    var plugins = {
      foo: {
        url: 'bar'
      }
    };

    PluginsManager.__set__('needInstall', function () {return false;});
    should(installPlugins(plugins)).be.false();
  });

  it('should set activated in the plugin to false', function () {
    var plugins = {
      foo: {
        url: 'bar'
      }
    };

    PluginsManager.__set__('needInstall', function () {return true;});
    installPlugins(plugins);

    should(plugins.foo.activated).be.false();
  });

  it('should let the plugin activated', function () {
    var plugins = {
      foo: {
        url: 'bar',
        activated: true
      }
    };

    PluginsManager.__set__('needInstall', function () {return true;});
    installPlugins(plugins);

    should(plugins.foo.activated).be.true();
  });

  it('should copy the default plugin activation if there is no "activated" attribute', function () {
    var
      customPlugins = {
        foo: {
          url: 'bar'
        }
      },
      defaultPlugins = {
        foo: {
          url: 'bar',
          activated: true
        }
      };

    PluginsManager.__set__('needInstall', function () {return true;});
    installPlugins(customPlugins, defaultPlugins);

    should(customPlugins.foo.activated).be.true();
  });

  it('should not copy the default plugin activation if there is "activated" attribute', function () {
    var
      customPlugins = {
        foo: {
          url: 'bar',
          activated: false
        }
      },
      defaultPlugins = {
        foo: {
          url: 'bar',
          activated: true
        }
      };

    PluginsManager.__set__('needInstall', function () {return true;});
    installPlugins(customPlugins, defaultPlugins);

    should(customPlugins.foo.activated).be.false();
  });
});