var
  should = require('should'),
  rewire = require('rewire'),
  sinon = require('sinon'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  path = require('path'),
  PluginsManager = rewire('../../../../lib/api/core/plugins/pluginsManager');

describe('PluginsManager: init()', () => {
  var
    kuzzle,
    pluginsManager;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    pluginsManager = new PluginsManager(kuzzle);
  });

  it('should load plugins at init', () => {
    var spy = sinon.spy();

    return PluginsManager.__with__({
      loadPlugins: spy
    })(() => {
      pluginsManager.init();
      should(spy)
        .be.calledOnce();
    });
  });
});

describe('PluginsManager: loadPlugins()', () => {
  var
    kuzzle,
    pluginsManager;

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    pluginsManager = new PluginsManager(kuzzle);
  });

  it('should return an empty object if no plugins are enabled', () => {
    return PluginsManager.__with__({
      fs: {
        readdirSync: () => {
          return [];
        }
      }
    })(() => {
      pluginsManager.init();
      should(pluginsManager.plugins)
        .be.eql({});
    });
  });

  it('should show a console error message if a malformed plugin is enabled', () => {
    let consoleSpy = sinon.spy();
    return PluginsManager.__with__({
      fs: {
        readdirSync: () => {
          return ['kuzzle-plugin-test'];
        },
        existsSync: () => {
          return true;
        },
        statSync: () => {
          return {
            isSymbolicLink: () => {
              return true;
            },
            isDirectory: () => {
              return true;
            }
          };
        }
      },
      loadPluginFromPackageJson: () => {
        throw new Error('oh crap!');
      },
      loadPluginFromDirectory: () => {
        throw new Error('oh crap!');
      },
      console: {
        error: consoleSpy
      }
    })(() => {
      pluginsManager.init();
      should(consoleSpy)
        .be.calledOnce();
    });
  });

  it('should return a well-formed plugin instance if a valid node-module plugin is enabled', () => {
    const pluginName = 'kuzzle-plugin-test';
    return PluginsManager.__with__({
      fs: {
        readdirSync: () => {
          return ['kuzzle-plugin-test'];
        },
        existsSync: () => {
          return true;
        },
        statSync: () => {
          return {
            isSymbolicLink: () => {
              return true;
            },
            isDirectory: () => {
              return true;
            }
          };
        }
      },
      require: (arg) => {
        if (path.extname(arg) === '.json') {
          return {
            name: pluginName
          };
        }
        return function () {
          return {
            kikou: 'LOL'
          };
        };
      }
    })(() => {
      pluginsManager.init();
      should(pluginsManager.plugins[pluginName])
        .be.Object();
      should(pluginsManager.plugins[pluginName])
        .have.keys('name', 'object', 'config', 'path');
      should(pluginsManager.plugins[pluginName].name)
        .be.eql(pluginName);
      should(pluginsManager.plugins[pluginName].object)
        .be.ok();
      should(pluginsManager.plugins[pluginName].path)
        .be.ok();
    });
  });

  it('should return a well-formed plugin instance if a valid requireable plugin is enabled', () => {
    const pluginName = 'kuzzle-plugin-test';
    return PluginsManager.__with__({
      fs: {
        readdirSync: () => {
          return ['kuzzle-plugin-test'];
        },
        existsSync: () => {
          return false;
        },
        statSync: () => {
          return {
            isSymbolicLink: () => {
              return false;
            },
            isDirectory: () => {
              return true;
            }
          };
        }
      },
      require: () => {
        return function () {
          return {
            kikou: 'LOL'
          };
        };
      }
    })(() => {
      pluginsManager.init();
      should(pluginsManager.plugins[pluginName])
        .be.Object();
      should(pluginsManager.plugins[pluginName])
        .have.keys('name', 'object', 'config', 'path');
      should(pluginsManager.plugins[pluginName].name)
        .be.eql(pluginName);
      should(pluginsManager.plugins[pluginName].object)
        .be.ok();
      should(pluginsManager.plugins[pluginName].path)
        .be.ok();
    });
  });
});
