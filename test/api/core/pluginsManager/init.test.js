'use strict';

const
  should = require('should'),
  mockrequire = require('mock-require'),
  rewire = require('rewire'),
  sinon = require('sinon'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  { PluginImplementationError } = require('kuzzle-common-objects').errors;

describe('PluginsManager', () => {
  let
    PluginsManager,
    pluginsManager,
    fsStub,
    manifestFsStub,
    kuzzle,
    pluginStub,
    Manifest;

  before(() => {
    manifestFsStub = {
      accessSync: sinon.stub(),
      constants: {
        R_OK: true
      }
    };
    Manifest = rewire('../../../../lib/api/core/plugins/manifest');
    Manifest.__set__({
      console: { warn: sinon.stub() },
      fs: manifestFsStub
    });
  });

  beforeEach(() => {
    pluginStub = function () {
      return {
        init: sinon.stub()
      };
    };

    fsStub = {
      readdirSync: sinon.stub().returns([]),
      accessSync: sinon.stub(),
      statSync: sinon.stub()
    };

    manifestFsStub.accessSync.returns();

    mockrequire('fs', fsStub);
    mockrequire('../../../../lib/api/core/plugins/manifest', Manifest);
    mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');
    PluginsManager = rewire('../../../../lib/api/core/plugins/pluginsManager');

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

  describe('#load', () => {
    it('should throw if the plugin directory cannot be accessed', () => {
      fsStub.readdirSync.returns(['kuzzle-plugin-test']);
      fsStub.statSync.throws();

      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test', undefined);

      should(() => pluginsManager.init())
        .throw(PluginImplementationError, {message: /unable to load plugin from path "\/kuzzle\/plugins\/enabled\/kuzzle-plugin-test"/i});
      should(pluginsManager.plugins).be.empty();
    });

    it('should throw if a plugin does not contain a manifest.json file nor a package.json one', () => {
      pluginsManager = new PluginsManager(kuzzle);
      manifestFsStub.accessSync.throws(new Error('foobar'));
      fsStub.readdirSync.returns(['kuzzle-plugin-test']);
      fsStub.statSync.returns({
        isDirectory () {
          return true;
        }
      });
      should(() => pluginsManager.init())
        .throw(PluginImplementationError, {message:  /\[\/kuzzle\/plugins\/enabled\/kuzzle-plugin-test\] No package\.json file found\./});
      should(pluginsManager.plugins).be.empty();
    });

    it('should throw if a plugin with the same name already exists', () => {
      const instanceName = 'kuzzle-plugin-test';
      pluginsManager = new PluginsManager(kuzzle);

      fsStub.readdirSync.returns([instanceName, 'another-plugin']);
      fsStub.statSync.returns({
        isDirectory: () => true
      });
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test', pluginStub);
      mockrequire('/kuzzle/plugins/enabled/another-plugin', pluginStub);
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test/manifest.json', { name: instanceName, kuzzleVersion: '^1.x'});
      mockrequire('/kuzzle/plugins/enabled/another-plugin/manifest.json', { name: instanceName, kuzzleVersion: '^1.x'});

      PluginsManager = mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');

      should(() => pluginsManager.init())
        .throw(PluginImplementationError, {message: /A plugin named kuzzle-plugin-test already exists/});
    });

    it('should throw if a plugin does not expose a "init" method', () => {
      const instanceName = 'kuzzle-plugin-test';
      pluginsManager = new PluginsManager(kuzzle);
      fsStub.readdirSync.returns(['kuzzle-plugin-test']);
      fsStub.statSync.returns({
        isDirectory: () => true
      });
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test', function () {
        return {};
      });
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test/manifest.json', { name: instanceName, kuzzleVersion: '^1.x'});
      PluginsManager = mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');

      should(() => pluginsManager.init())
        .throw(PluginImplementationError, {message: /\[kuzzle-plugin-test\] No "init" method found\./});
    });

    it('should return a well-formed plugin instance if a valid requirable plugin is enabled', () => {
      const instanceName = 'kuzzle-plugin-test';
      pluginsManager = new PluginsManager(kuzzle);
      fsStub.readdirSync.returns(['kuzzle-plugin-test']);
      fsStub.statSync.returns({
        isDirectory: () => true
      });
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test', pluginStub);
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test/manifest.json', {
        name: 'kuzzle-plugin-test',
        kuzzleVersion: '^1.x'
      });
      PluginsManager = mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');

      should(() => pluginsManager.init()).not.throw();
      should(pluginsManager.plugins[instanceName]).be.Object();
      should(pluginsManager.plugins[instanceName]).have.keys('object', 'config', 'manifest');
      should(pluginsManager.plugins[instanceName].config).be.eql({});
      should(pluginsManager.plugins[instanceName].manifest)
        .instanceOf(Manifest)
        .match({
          name: instanceName,
          privileged: false,
          kuzzleVersion: '^1.x',
          path: '/kuzzle/plugins/enabled/kuzzle-plugin-test'
        });
      should(pluginsManager.plugins[instanceName].object).be.ok();
    });

    it('should reject plugin initialization if a plugin requires another version of kuzzle core', () => {
      const manifest = {
        name: 'kuzzle-plugin-test',
        kuzzleVersion: '^5.x'
      };

      fsStub.readdirSync.returns(['kuzzle-plugin-test']);
      fsStub.statSync.returns({
        isDirectory: () => true
      });

      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test', pluginStub);
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test/manifest.json', manifest);
      PluginsManager = mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');

      kuzzle.config.version = '1.0.0';
      pluginsManager = new PluginsManager(kuzzle);

      const message = new RegExp(`\\[/kuzzle/plugins/enabled/kuzzle-plugin-test/manifest\\.json\\] Version mismatch: current Kuzzle version ${kuzzle.config.version} does not match the manifest requirements \\(\\^5\\.x\\)`);

      should(() => pluginsManager.init())
        .throw(PluginImplementationError, {message});
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

      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test', pluginStub);
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test/manifest.json', { name: 'kuzzle-plugin-test', kuzzleVersion: '^1.x' });
      PluginsManager = mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');

      pluginsManager = new PluginsManager(kuzzle);

      should(() => pluginsManager.init()).not.throw();
      should(pluginsManager.plugins[instanceName]).be.Object();
      should(pluginsManager.plugins[instanceName]).have.keys('object', 'config', 'manifest');
      should(pluginsManager.plugins[instanceName].manifest)
        .instanceOf(Manifest)
        .match({name: instanceName});
      should(pluginsManager.plugins[instanceName].config).be.eql(config);
      should(pluginsManager.plugins[instanceName].object).be.ok();
    });

    it('should throw if trying to set a privileged plugin which does not support privileged mode', () => {
      const instanceName = 'kuzzle-plugin-test';
      const manifest = {
        name: instanceName,
        kuzzleVersion: '^1.x',
        privileged: false
      };

      kuzzle.config.plugins[instanceName] = {
        privileged: true
      };

      fsStub.readdirSync.returns(['kuzzle-plugin-test']);
      fsStub.statSync.returns({
        isDirectory: () => true
      });

      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test', pluginStub);
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test/manifest.json', manifest);
      PluginsManager = mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');

      pluginsManager = new PluginsManager(kuzzle);

      should(() => pluginsManager.init()).throw(/the plugin "kuzzle-plugin-test" is configured to run in privileged mode, but it does not seem to support it/i);
    });

    it('should throw if a plugin requires to be in a privileged mode but user has not acknowledged this', () => {
      const instanceName = 'kuzzle-plugin-test';
      const manifest = {
        privileged: true,
        kuzzleVersion: '^1.x',
        name: instanceName
      };

      kuzzle.config.plugins[instanceName] = {
        privileged: false
      };

      fsStub.readdirSync.returns(['kuzzle-plugin-test']);
      fsStub.statSync.returns({
        isDirectory: () => true
      });

      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test', pluginStub);
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test/manifest.json', manifest);
      PluginsManager = mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');

      pluginsManager = new PluginsManager(kuzzle);

      should(() => pluginsManager.init()).throw(/the plugin "kuzzle-plugin-test" needs to run in privileged mode to work, you have to explicitly set "privileged: true" in its configuration/i);
    });

    it('should throw if the enabled plugins directory cannot be required', () => {
      fsStub.readdirSync.throws();

      should(() => pluginsManager.init())
        .throw(PluginImplementationError, {message: /Unable to load plugins from directory/});
      should(pluginsManager.plugins).be.empty();
    });

    it('should throw if a specific plugin cannot be required', () => {
      fsStub.readdirSync.returns(['kuzzle-plugin-test']);
      fsStub.statSync.returns({
        isDirectory: () => true
      });

      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test', function () { throw new Error('foobar'); });
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test/manifest.json', { name: 'kuzzle-plugin-test', kuzzleVersion: '^1.x' });
      PluginsManager = mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');

      should(() => pluginsManager.init()).throw(PluginImplementationError, {message: /foobar/});
      should(pluginsManager.plugins).be.empty();
    });

    it('should throw if the required plugin module is not a constructor', () => {
      fsStub.readdirSync.returns(['kuzzle-plugin-test']);
      fsStub.statSync.returns({
        isDirectory: () => true
      });

      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test', () => {});
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test/manifest.json', { name: 'kuzzle-plugin-test', kuzzleVersion: '^1.x' });
      PluginsManager = mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');

      should(() => pluginsManager.init())
        .throw(PluginImplementationError, {message: /Plugin kuzzle-plugin-test is not a constructor/});
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
