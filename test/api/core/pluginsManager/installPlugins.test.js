var
  should = require('should'),
  rewire = require('rewire'),
  PluginsManager = rewire('../../../../lib/api/core/pluginsManager'),
  EventEmitter = require('eventemitter2').EventEmitter2;

describe('Test plugins manager installation', function () {

  var installPlugins;

  before(function () {
    PluginsManager.__set__('initConfig', function () {});
    PluginsManager.__set__('npmInstall', function () {});
    PluginsManager.__set__('kuzzle', {log: {info: function () {}}});
    installPlugins = PluginsManager.__get__('installPlugins');
  });

  it('should return false if there is no plugins', function () {
    should(installPlugins([])).be.false();
  });

  it('should return true if there is plugin to install with url', function () {
    var plugins = [
      {
        url: 'foo',
        name: 'bar'
      }
    ];

    PluginsManager.__set__('needInstall', function () {return true;});
    should(installPlugins(plugins)).be.true();
  });

  it('should return true if there is plugin to install with name and version', function () {
    var plugins = [
      {
        version: 3,
        name: 'bar'
      }
    ];

    PluginsManager.__set__('needInstall', function () {return true;});
    should(installPlugins(plugins)).be.true();
  });

  it('should return true if there is plugin but already installed', function () {
    var plugins = [
      {
        url: 'foo',
        name: 'bar'
      }
    ];

    PluginsManager.__set__('needInstall', function () {return false;});
    should(installPlugins(plugins)).be.false();
  });

});