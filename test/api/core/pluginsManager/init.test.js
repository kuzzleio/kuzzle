'use strict';

const
  should = require('should'),
  mockrequire = require('mock-require'),
  rewire = require('rewire'),
  sinon = require('sinon'),
  KuzzleMock = require('../../../mocks/kuzzle.mock');

describe('PluginsManager', () => {
  let
    PluginsManager,
    pluginsManager,
    fsStub,
    kuzzle;

  beforeEach(() => {
    fsStub = {
      readdirSync: sinon.stub().returns([]),
      accessSync: sinon.stub(),
      statSync: sinon.stub()
    };

    mockrequire('fs', fsStub);
    mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');
    PluginsManager = rewire('../../../../lib/api/core/plugins/pluginsManager');

    // making it quiet
    PluginsManager.__set__({
      console: {
        log: sinon.stub(),
        error: sinon.stub(),
        warn: sinon.stub()
      }
    });

    kuzzle = new KuzzleMock();
    pluginsManager = new PluginsManager(kuzzle);
  });

  afterEach(() => {
    mockrequire.stopAll();
  });

  describe('#init', () => {
    it('should load plugins at init', () => {
      pluginsManager.init();
      should(fsStub.readdirSync.calledOnce).be.true();
      should(pluginsManager.plugins).be.an.Object().and.be.empty();
    });
  });

  describe('#loadPlugins', () => {
    it('should reject all plugin initialization if an error occurs when loading a non readable directory', () => {
      fsStub.readdirSync.returns(['kuzzle-plugin-test']);
      fsStub.statSync.throws();

      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test', undefined);

      should(() => pluginsManager.init()).throw(/unable to load plugin from path "\/kuzzle\/plugins\/enabled\/kuzzle-plugin-test"/i);
      should(pluginsManager.plugins).be.empty();
    });

    it('should reject all plugin initialization if a plugin does not contain package.json', () => {
      PluginsManager.__with__({
        require: moduleName => {
          if (moduleName.indexOf('package.json') > -1) {
            throw new Error('oh crap!');
          }
        }
      })(() => {
        pluginsManager = new PluginsManager(kuzzle);
        fsStub.readdirSync.returns(['kuzzle-plugin-test']);
        fsStub.statSync.returns({
          isDirectory () {
            return true;
          }
        });
        should(() => pluginsManager.init()).throw(/Unable to load plugin from path "kuzzle-plugin-test"; No package.json found./i);
        should(pluginsManager.plugins).be.empty();
      });
    });

    it('should throw if a plugin with the same name already exists', () => {
      const instanceName = 'kuzzle-plugin-test';
      pluginsManager = new PluginsManager(kuzzle);
      fsStub.readdirSync.returns([instanceName, 'another-plugin']);
      fsStub.statSync.returns({
        isDirectory: () => true
      });
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test', function () {});
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test/package.json', { name: instanceName});
      mockrequire('/kuzzle/plugins/enabled/another-plugin/package.json', { name: instanceName.toUpperCase()});
      PluginsManager = mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');

      should(() => pluginsManager.init()).throw(/A plugin named kuzzle-plugin-test already exists/);
    });

    it('should return a well-formed plugin instance if a valid requireable plugin is enabled', () => {
      const instanceName = 'kuzzle-plugin-test';
      pluginsManager = new PluginsManager(kuzzle);
      fsStub.readdirSync.returns(['kuzzle-plugin-test']);
      fsStub.statSync.returns({
        isDirectory: () => true
      });
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test', function () {});
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test/package.json', { name: 'kuzzle-plugin-test' });
      PluginsManager = mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');

      should(() => pluginsManager.init()).not.throw();
      should(pluginsManager.plugins[instanceName]).be.Object();
      should(pluginsManager.plugins[instanceName]).have.keys('name', 'object', 'config', 'manifest', 'path');
      should(pluginsManager.plugins[instanceName].name).be.eql(instanceName);
      should(pluginsManager.plugins[instanceName].config).be.eql({});
      should(pluginsManager.plugins[instanceName].manifest).be.eql({
        privileged: false,
        kuzzleVersion: '1.x'
      });
      should(pluginsManager.plugins[instanceName].object).be.ok();
      should(pluginsManager.plugins[instanceName].path).be.ok();
    });

    it('should reject plugin initialization if a plugin requires another version of kuzzle core', () => {
      const manifest = {
        kuzzleVersion: '5.x'
      };

      fsStub.readdirSync.returns(['kuzzle-plugin-test']);
      fsStub.statSync.returns({
        isDirectory: () => true
      });

      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test', function () {});
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test/package.json', { name: 'kuzzle-plugin-test' });
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test/manifest.json', manifest);
      PluginsManager = mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');

      kuzzle.config.version = '1.0.0';
      pluginsManager = new PluginsManager(kuzzle);

      should(() => pluginsManager.init()).throw(/required kuzzle version \(5\.x\) does not satisfies current: 1\.0\.0/);
    });

    it('should load custom plugin configuration if exists', () => {
      const instanceName = 'kuzzle-plugin-test';
      const config = {
        foo: 'bar'
      };

      kuzzle.config.plugins[instanceName] = config;

      fsStub.readdirSync.returns(['kuzzle-plugin-test']);
      fsStub.statSync.returns({
        isDirectory: () => true
      });

      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test', function () {});
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test/package.json', { name: 'kuzzle-plugin-test' });
      PluginsManager = mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');

      pluginsManager = new PluginsManager(kuzzle);

      should(() => pluginsManager.init()).not.throw();
      should(pluginsManager.plugins[instanceName]).be.Object();
      should(pluginsManager.plugins[instanceName]).have.keys('name', 'object', 'config', 'manifest', 'path');
      should(pluginsManager.plugins[instanceName].name).be.eql(instanceName);
      should(pluginsManager.plugins[instanceName].config).be.eql(config);
      should(pluginsManager.plugins[instanceName].object).be.ok();
      should(pluginsManager.plugins[instanceName].path).be.ok();
    });

    it('should throw if trying to set a privileged plugin which does not support privileged mode', () => {
      const instanceName = 'kuzzle-plugin-test';
      const manifest = {
        privileged: false
      };

      kuzzle.config.plugins[instanceName] = {
        privileged: true
      };

      fsStub.readdirSync.returns(['kuzzle-plugin-test']);
      fsStub.statSync.returns({
        isDirectory: () => true
      });

      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test', function () {});
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test/manifest.json', manifest);
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test/package.json', { name: 'kuzzle-plugin-test' });
      PluginsManager = mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');

      pluginsManager = new PluginsManager(kuzzle);

      should(() => pluginsManager.init()).throw(/the plugin "kuzzle-plugin-test" is configured to run in privileged mode, but it does not seem to support it/i);
    });

    it('should throw if a plugin requires to be in a privileged mode but user has not acknowledged this', () => {
      const instanceName = 'kuzzle-plugin-test';
      const manifest = {
        privileged: true
      };

      kuzzle.config.plugins[instanceName] = {
        privileged: false
      };

      fsStub.readdirSync.returns(['kuzzle-plugin-test']);
      fsStub.statSync.returns({
        isDirectory: () => true
      });

      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test', function () {});
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test/manifest.json', manifest);
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test/package.json', { name: 'kuzzle-plugin-test' });
      PluginsManager = mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');

      pluginsManager = new PluginsManager(kuzzle);

      should(() => pluginsManager.init()).throw(/the plugin "kuzzle-plugin-test" needs to run in privileged mode to work, you have to explicitly set "privileged: true" in its configuration/i);
    });

    it('should reject all plugin initialization if an error occurs when loading a non requireable directory', () => {
      fsStub.readdirSync.throws();

      should(() => pluginsManager.init()).throw(/unable to load plugins from directory/i);
      should(pluginsManager.plugins).be.empty();
    });

    it('should reject all plugin initialization if an error occurs when loading a non requireable directory', () => {
      fsStub.readdirSync.returns(['kuzzle-plugin-test']);
      fsStub.statSync.returns({
        isDirectory: () => true
      });

      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test', function () { throw new Error('foobar'); });
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test/package.json', { name: 'kuzzle-plugin-test' });
      PluginsManager = mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');

      should(() => pluginsManager.init()).throw(/foobar/);
      should(pluginsManager.plugins).be.empty();
    });

    it('should reject all plugin initialization if a plugin is not a constructor', () => {
      fsStub.readdirSync.returns(['kuzzle-plugin-test']);
      fsStub.statSync.returns({
        isDirectory: () => true
      });

      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test', undefined);
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test/package.json', { name: 'kuzzle-plugin-test' });
      PluginsManager = mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');

      should(() => pluginsManager.init()).throw(/Plugin kuzzle-plugin-test is not a constructor/i);
      should(pluginsManager.plugins).be.empty();
    });
  });

  describe('Test plugins manager listStrategies', () => {
    it('should return a list of registrated authentication strategies', () => {
      pluginsManager.strategies = {foo: {strategy: {}, methods: {}}};

      const strategies = pluginsManager.listStrategies();
      should(strategies).be.an.Array().of.length(1);
      should(strategies).match(['foo']);
    });
  });
});
