var
  should = require('should'),
  rewire = require('rewire'),
  PluginsManager = rewire('../../../../lib/api/core/pluginsManager');

describe('Test plugins manager needInstall function', function () {

  var needInstall;

  before(function () {
    needInstall = PluginsManager.__get__('needInstall');
  });

  it('should return true if the plugin come from git', function () {
    should(needInstall('foo', 'git+http://bar.com')).be.true();
  });

  it('should return true if the directory doesn\'t exist', function () {
    PluginsManager.__with__({
      fs: {
        existsSync: function () { return false; }
      }
    })(function () {
      should(needInstall('foo', 'bar')).be.true();
    });
  });
});