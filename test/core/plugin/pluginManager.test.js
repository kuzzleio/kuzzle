'use strict';

const _ = require('lodash');
const should = require('should');
const mockrequire = require('mock-require');
const rewire = require('rewire');
const sinon = require('sinon');
const path = require('path');

const PluginManager = require('../../../lib/core/plugin/pluginManager');
const Plugin = require('../../../lib/core/plugin/plugin');
const KuzzleMock = require('../../mocks/kuzzle.mock');

describe('Plugin', () => {
  let kuzzle;
  let plugin;
  let application;
  let pluginManager;

  const createPlugin = (name, application = false) => {
    const instance = {
      init: sinon.stub().resolves(),
      config: {}
    };

    return new Plugin(kuzzle, instance, { name, application });
  };
  const createApplication = name => createPlugin(name, true);

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    plugin = createPlugin('test-plugin')
    application = createApplication('lambda-core');

    pluginManager = new PluginManager(kuzzle);
  });

  describe('#set application', () => {
    it('should adds the application to plugins', () => {
      pluginManager.application = application;
      pluginManager._plugins.set(plugin.name, plugin);

      should(pluginManager._plugins.get(application.name)).be.eql(application);
      should(pluginManager.application).be.eql(application);
    });

    it('should throws error if there is already application', () => {
      pluginManager.application = application;

      should(() => {
        pluginManager.application = application;
      }).throw();
    });

    it('should throws error if there is already plugins', () => {
      pluginManager._plugins.set(plugin.name, plugin);

      should(() => {
        pluginManager.application = application;
      }).throw();
    });
  });

  describe('#get plugins', () => {
    it('should returns plugins', () => {
      pluginManager.application = application;
      pluginManager._plugins.set(plugin.name, plugin);

      should(pluginManager.plugins).be.length(1);
      should(pluginManager.plugins[0]).be.eql(plugin);
    });
  });

  describe('#getPluginsDescription', () => {
    it('should returns plugins descriptions', () => {
      const otherPlugin = createPlugin('other-plugin')
      otherPlugin.info = sinon.stub().returns('other-plugin');
      plugin.info = sinon.stub().returns('plugin');
      pluginManager._plugins.set(plugin.name, plugin);
      pluginManager._plugins.set(otherPlugin.name, otherPlugin);

      const description = pluginManager.getPluginsDescription();

      should(description).match({
        'test-plugin': 'plugin',
        'other-plugin': 'other-plugin'
      });
    });
  });

  describe.only('#init', () => {
    beforeEach(() => {
      pluginManager._initControllers = sinon.stub();
      pluginManager._initApi = sinon.stub();
      pluginManager._initAuthenticators = sinon.stub();
      pluginManager._initStrategies = sinon.stub();
      pluginManager._initHooks = sinon.stub();
      pluginManager._initPipes = sinon.stub();
      pluginManager.loadPlugins = sinon.stub().returns(new Map());
    });

    it('should loads plugins with existing plugins', async () => {
      const otherPlugin = createPlugin('other-plugin')
      pluginManager.loadPlugins.returns(new Map([[otherPlugin.name, otherPlugin]]));
      pluginManager._plugins.set(plugin.name, plugin);

      await pluginManager.init('additional plugins');

      should(pluginManager._plugins.get(plugin.name)).be.eql(plugin);
      should(pluginManager._plugins.get(otherPlugin.name)).be.eql(otherPlugin);
    });

    it('should registers plugin:hook:loop-error handler', async () => {
      await pluginManager.init();

      should(kuzzle.on).be.calledOnce();
      should(kuzzle.on.getCall(0).args[0]).be.eql('plugin:hook:loop-error');
    });

    it('should calls the application init function', async () => {
      application.init = sinon.stub();
      pluginManager.application = application;

      await pluginManager.init();

      should(pluginManager.application.init).be.calledWith(application.name);
    });

    it('should calls each plugin instance init function', async () => {
      pluginManager.application = application;
      pluginManager._plugins.set(plugin.name, plugin);

      await pluginManager.init();

      should(plugin.instance.init).be.calledWith(plugin.config, plugin.context);
      should(application.instance.init).be.calledWith(application.config, application.context);
      should(plugin.initCalled).be.true();
      should(application.initCalled).be.true();
    });

    it('should registers plugins features', async () => {
      pluginManager.config.common = {
        pipeWarnTime: 42,
        pipeTimeout: 42,
        initTimeout: 100
      };
      application.instance.api = 'api';
      application.instance.hooks = 'hooks';
      application.instance.pipes = 'pipe';
      plugin.instance.controllers = 'controllers';
      plugin.instance.authenticators = 'authenticators';
      plugin.instance.strategies = 'strategies';
      pluginManager.application = application;
      pluginManager._plugins.set(plugin.name, plugin);

      await pluginManager.init();

      should(pluginManager._initApi).be.calledWith(application);
      should(pluginManager._initHooks).be.calledWith(application);
      should(pluginManager._initPipes).be.calledWith(application, 42, 42);
      should(pluginManager._initControllers).be.calledWith(plugin);
      should(pluginManager._initAuthenticators).be.calledWith(plugin);
      should(pluginManager._initStrategies).be.calledWith(plugin);
    });

    it('should throws an error if a plugin init method take too long', () => {
      pluginManager.config.common = {
        initTimeout: 10
      };
      pluginManager.application = application;
      application.instance.init = () => new Promise(resolve => setTimeout(resolve, 15));

      return should(pluginManager.init()).be.rejected();
    });
  });

  describe('#_initApi', () => {
    it('', () => {

    });
  });

  describe('#_initControllers', () => {
    it('', () => {

    });
  });

  describe('#_initAuthenticators', () => {
    it('', () => {

    });
  });

  describe('#_initStrategies', () => {
    it('', () => {

    });
  });

  describe('#_initHooks', () => {
    it('', () => {

    });
  });

  describe('#_initPipes', () => {
    it('', () => {

    });
  });

  describe('#loadPlugins', () => {
    it('', () => {

    });
  });
});
