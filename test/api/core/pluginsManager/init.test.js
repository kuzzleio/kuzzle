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
    it('should discard a plugin if loading it from package.json fails', () => {
      fsStub.readdirSync.returns(['kuzzle-plugin-test']);
      fsStub.statSync.returns({
        isDirectory: () => true
      });

      should(() => pluginsManager.init()).not.throw();
      should(pluginsManager.plugins).be.empty();
    });

    it('should discard a plugin if loading it from a directory fails', () => {
      fsStub.accessSync.throws(new Error('package.json does not exist'));
      fsStub.readdirSync.returns(['kuzzle-plugin-test']);
      fsStub.statSync.returns({
        isDirectory: () => true
      });

      should(() => pluginsManager.init()).not.throw();
      should(pluginsManager.plugins).be.empty();
    });

    it('should return a well-formed plugin instance if a valid node-module plugin is enabled', () => {
      fsStub.readdirSync.returns(['kuzzle-plugin-test']);
      fsStub.statSync.returns({
        isDirectory: () => true
      });

      const name = 'kuzzle-plugin-test';
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test', function () {});
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test/package.json', {name});
      PluginsManager = mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');

      pluginsManager = new PluginsManager(kuzzle);

      pluginsManager.init();
      should(pluginsManager.plugins[name]).be.Object();
      should(pluginsManager.plugins[name]).have.keys('name', 'object', 'config', 'path');
      should(pluginsManager.plugins[name].name).be.eql(name);
      should(pluginsManager.plugins[name].object).be.ok();
      should(pluginsManager.plugins[name].path).be.ok();
    });

    it('should return a well-formed plugin instance if a valid requireable plugin is enabled', () => {
      const name = 'kuzzle-plugin-test';
      fsStub.readdirSync.returns(['kuzzle-plugin-test']);
      fsStub.accessSync.throws(new Error('package.json does not exist'));
      fsStub.statSync.returns({
        isDirectory: () => true
      });

      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test', function () {});
      mockrequire('/kuzzle/plugins/enabled/kuzzle-plugin-test/package.json', {name});
      PluginsManager = mockrequire.reRequire('../../../../lib/api/core/plugins/pluginsManager');

      pluginsManager = new PluginsManager(kuzzle);

      pluginsManager.init();
      should(pluginsManager.plugins[name]).be.Object();
      should(pluginsManager.plugins[name]).have.keys('name', 'object', 'config', 'path');
      should(pluginsManager.plugins[name].name).be.eql(name);
      should(pluginsManager.plugins[name].object).be.ok();
      should(pluginsManager.plugins[name].path).be.ok();
    });
  });
});
