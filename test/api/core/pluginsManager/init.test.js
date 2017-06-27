'use strict';

const
  should = require('should'),
  mockrequire = require('mock-require'),
  sinon = require('sinon'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  {
    PluginImplementationError
  } = require('kuzzle-common-objects').errors;

describe.only('PluginsManager', () => {
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

  after(() => {
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
    it('should reject all plugin initialization if an error occurs when loading a non requireable directory', () => {
      fsStub.readdirSync.returns(['kuzzle-plugin-test']);
      fsStub.statSync.returns({
        isDirectory: () => true
      });

      should(() => pluginsManager.init()).throw();
      should(pluginsManager.plugins).be.empty();
    });

    it('should return a well-formed plugin instance if a valid requireable plugin is enabled', () => {
      const instanceName = 'kuzzle-plugin-test';
      fsStub.readdirSync.returns(['kuzzle-plugin-test']);
      fsStub.statSync.returns({
        isDirectory: () => true
      });

      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test', function () {});
      PluginsManager = mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');

      pluginsManager = new PluginsManager(kuzzle);

      pluginsManager.init();
      should(pluginsManager.plugins[instanceName]).be.Object();
      should(pluginsManager.plugins[instanceName]).have.keys('name', 'object', 'config', 'manifest', 'path');
      should(pluginsManager.plugins[instanceName].name).be.eql(instanceName);
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
      PluginsManager = mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');

      pluginsManager = new PluginsManager(kuzzle);

      pluginsManager.init();
      should(pluginsManager.plugins[instanceName]).be.Object();
      should(pluginsManager.plugins[instanceName]).have.keys('name', 'object', 'config', 'manifest', 'path');
      should(pluginsManager.plugins[instanceName].name).be.eql(instanceName);
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
        kuzzleVersion: "5.x"
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
  });


  describe('Test plugins manager listStrategies', () => {
    it('should return a list of registrated authentication strategies', () => {
      pluginsManager.registeredStrategies = ['strategy'];

      should(pluginsManager.listStrategies()).be.an.Array().of.length(1);
    });
  });
});
