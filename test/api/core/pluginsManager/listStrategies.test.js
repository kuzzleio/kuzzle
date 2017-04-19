'use strict';

const
  should = require('should'),
  /** @type {Params} */
  rewire = require('rewire'),
  sinon = require('sinon'),
  PluginsManager = rewire('../../../../lib/api/core/plugins/pluginsManager'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  PluginContext = rewire('../../../../lib/api/core/plugins/pluginContext'),
  PassportStrategy = require('passport-strategy'),
  PluginImplementationError = require('kuzzle-common-objects').errors.PluginImplementationError;

describe('Test plugins manager listStrategies', () => {
  let
    sandbox,
    plugin,
    kuzzle,
    context;

  before(() => {

    PluginsManager.__set__('console', {
      log: () => {},
      error: () => {},
      warn: () => {},
    });
  });

  beforeEach(() => {
    kuzzle = new KuzzleMock();

    sandbox = sinon.sandbox.create();
    kuzzle.pluginsManager = new PluginsManager(kuzzle);
    context = new PluginContext(kuzzle, 'test-auth-plugin');

    plugin = {
      object: {
        init: () => {
          context.accessors.registerStrategy(PassportStrategy, 'local', context, function() {});
        }
      },
      config: {}
    };

    kuzzle.pluginsManager.plugins = {testAuthPlugin: plugin};
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should return a list of registrated authentication strategies', () => {
    return kuzzle.pluginsManager.listStrategies()
      .then(result => {
        should(result).be.an.Array().of.length(0);
      });
  });

  it('should return a strategy when a plugin registers its strategy', () => {
    plugin.object.init();

    return kuzzle.pluginsManager.listStrategies()
      .then(result => {
        should(result).be.an.Array().of.length(1);
        should(result).match(['local']);
      });
  });

  it('should throw an error if another plugins tries to register an already registered authentication strategy', () => {
    let plugins = kuzzle.pluginsManager.plugins;

    plugins.otherTestAuthPlugin = plugin;

    should(() => {
      Object.keys(plugins).forEach(p => plugins[p].object.init());
    }).throw(PluginImplementationError);
  });
});
