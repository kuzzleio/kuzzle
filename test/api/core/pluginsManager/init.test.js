'use strict';

const
  should = require('should'),
  mockrequire = require('mock-require'),
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

    PluginsManager = mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');

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

    it('should return a well-formed plugin instance if a valid requireable plugin is enabled', () => {
      const instanceName = 'kuzzle-plugin-test';
      fsStub.readdirSync.returns(['kuzzle-plugin-test']);
      fsStub.statSync.returns({
        isDirectory: () => true
      });

      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test', function () {});

      should(() => pluginsManager.init()).not.throw();
      should(pluginsManager.plugins[instanceName]).be.Object();
      should(pluginsManager.plugins[instanceName]).have.keys('name', 'object', 'config', 'manifest', 'path');
      should(pluginsManager.plugins[instanceName].name).be.eql(instanceName);
      should(pluginsManager.plugins[instanceName].config).be.eql({});
      should(pluginsManager.plugins[instanceName].manifest).be.eql({
        name: undefined,
        version: '1.0.0',
        threadable: true,
        privileged: false,
        kuzzleVersion: '1.x'
      });
      should(pluginsManager.plugins[instanceName].object).be.ok();
      should(pluginsManager.plugins[instanceName].path).be.ok();
    });

    it('should load plugin manifest if exists', () => {
      const instanceName = 'kuzzle-plugin-test';
      const manifest = {
        name: 'plugin-42',
        version: '1.2.0',
        threadable: false
      };

      fsStub.readdirSync.returns(['kuzzle-plugin-test']);
      fsStub.statSync.returns({
        isDirectory: () => true
      });

      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test', function () {});
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test/manifest.json', manifest);

      should(() => pluginsManager.init()).not.throw();
      should(pluginsManager.plugins[instanceName]).be.Object();
      should(pluginsManager.plugins[instanceName]).have.keys('name', 'object', 'config', 'manifest', 'path');
      should(pluginsManager.plugins[instanceName].name).be.eql(instanceName);
      should(pluginsManager.plugins[instanceName].config).be.eql({});
      should(pluginsManager.plugins[instanceName].manifest).be.eql({
        name: manifest.name,
        version: manifest.version,
        threadable: manifest.threadable,
        privileged: false,
        kuzzleVersion: '1.x'
      });
      should(pluginsManager.plugins[instanceName].object).be.ok();
      should(pluginsManager.plugins[instanceName].path).be.ok();
    });

    it('should reject plugin initialization if a plugin require another version of kuzzle core', () => {
      const name = 'plugin-42';
      const manifest = {
        name,
        kuzzleVersion: '5.x'
      };

      fsStub.readdirSync.returns(['kuzzle-plugin-test']);
      fsStub.statSync.returns({
        isDirectory: () => true
      });

      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test', function () {});
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

      pluginsManager = new PluginsManager(kuzzle);

      should(() => pluginsManager.init()).not.throw();
      should(pluginsManager.plugins[instanceName]).be.Object();
      should(pluginsManager.plugins[instanceName]).have.keys('name', 'object', 'config', 'manifest', 'path');
      should(pluginsManager.plugins[instanceName].name).be.eql(instanceName);
      should(pluginsManager.plugins[instanceName].config).be.eql(config);
      should(pluginsManager.plugins[instanceName].object).be.ok();
      should(pluginsManager.plugins[instanceName].path).be.ok();
    });

    it('should throw if trying to register a non compatible worker plugin', () => {
      const instanceName = 'kuzzle-plugin-test';
      const manifest = {
        threadable: true
      };

      kuzzle.config.plugins[instanceName] = {
        threads: 2
      };

      fsStub.readdirSync.returns(['kuzzle-plugin-test']);
      fsStub.statSync.returns({
        isDirectory: () => true
      });

      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test', function () {
        return {
          pipes: {foo: 'bar'}
        };
      });
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test/manifest.json', manifest);

      pluginsManager = new PluginsManager(kuzzle);

      should(() => pluginsManager.init()).throw(/the plugin "kuzzle-plugin-test" is configured to run as worker but this plugin register non threadable features \(pipes, controllers, routes, strategies\)/i);
    });

    it('should throw if trying to set a worker plugin which does not support multi-threading', () => {
      const instanceName = 'kuzzle-plugin-test';
      const manifest = {
        threadable: false
      };

      kuzzle.config.plugins[instanceName] = {
        threads: 2
      };

      fsStub.readdirSync.returns(['kuzzle-plugin-test']);
      fsStub.statSync.returns({
        isDirectory: () => true
      });

      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test', function () {});
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test/manifest.json', manifest);

      pluginsManager = new PluginsManager(kuzzle);

      should(() => pluginsManager.init()).throw(/the plugin "kuzzle-plugin-test" is configured to run as worker but this plugin does not support multi-threading/i);
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

      pluginsManager = new PluginsManager(kuzzle);

      should(() => pluginsManager.init()).throw(/the plugin "kuzzle-plugin-test" is configured to run as privileged mode but it does not support privileged mode/i);
    });

    it('should throw if a plugin require to be in a privileged mode but user has not acknowleged this', () => {
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

      pluginsManager = new PluginsManager(kuzzle);

      should(() => pluginsManager.init()).throw(/the plugin "kuzzle-plugin-test" need to run in privileged mode to work, you have to explicitly set "privileged: true" in it configuration/i);
    });

    it('should reject all plugin initialization if an error occurs when loading a non requireable directory', () => {
      fsStub.readdirSync.returns(['kuzzle-plugin-test']);
      fsStub.statSync.returns({
        isDirectory: () => true
      });

      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test', undefined);

      should(() => pluginsManager.init()).throw(/unable to require plugin "kuzzle-plugin-test" from directory "\/kuzzle\/plugins\/enabled\/kuzzle-plugin-test"/i);
      should(pluginsManager.plugins).be.empty();
    });
  });


  describe('Test plugins manager listStrategies', () => {
    it('should return a list of registrated authentication strategies', () => {
      pluginsManager.registeredStrategies = ['strategy'];

      should(pluginsManager.listStrategies()).be.an.Array().of.length(1);
    });
  });
});
