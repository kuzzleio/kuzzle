'use strict';

const
  should = require('should'),
  rewire = require('rewire'),
  sinon = require('sinon'),
  KuzzleMock = require('../../../mocks/kuzzle.mock'),
  PluginsManager = rewire('../../../../lib/api/core/plugins/pluginsManager'),
  PluginImplementationError = require('kuzzle-common-objects').errors.PluginImplementationError;

describe('PluginsManager: strategy management', () => {
  let
    kuzzle,
    pluginsManager,
    plugin = {
      name: 'some-plugin-name',
      path: {},
      object: null,
      config: {},
      manifest: {}
    },
    pluginManagerStrategy,
    sandbox = sinon.sandbox.create(),
    foo = {foo: 'bar'};

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    /** @type {PluginsManager} */
    pluginsManager = new PluginsManager(kuzzle);

    plugin.object = {
      strategies: {
        someStrategy: {
          config: {
            constructor: sandbox.stub(),
            strategyOptions: {
              someStrategy: 'options'
            },
            authenticateOptions: {
              someAuthenticate: 'options'
            },
            fields: ['aField', 'anotherField']
          },
          methods: {
            afterRegister: 'afterRegisterFunction',
            create: 'createFunction',
            delete: 'deleteFunction',
            exists: 'existsFunction',
            getById: 'getByIdFunction',
            getInfo: 'getInfoFunction',
            update: 'updateFunction',
            validate: 'validateFunction',
            verify: 'verifyFunction'
          }
        }
      },
      afterRegisterFunction: sandbox.stub(),
      createFunction: sandbox.stub(),
      existsFunction: sandbox.stub(),
      deleteFunction: sandbox.stub(),
      getByIdFunction: sandbox.stub(),
      getInfoFunction: sandbox.stub(),
      updateFunction: sandbox.stub(),
      validateFunction: sandbox.stub(),
      verifyFunction: sandbox.stub()
    };

    pluginManagerStrategy = {
      strategy: plugin.object.strategies.someStrategy,
      methods: {
        exists: plugin.object.existsFunction,
        create: plugin.object.createFunction,
        update: plugin.object.updateFunction,
        delete: plugin.object.deleteFunction,
        getById: plugin.object.getByIdFunction,
        getInfo: plugin.object.getInfoFunction,
        validate: plugin.object.validateFunction,
        afterRegister: plugin.object.afterRegisterFunction
      }
    };

    pluginsManager.authentications.someStrategy = pluginManagerStrategy;

    sandbox.reset();
  });

  describe('#getStrategyFields', () => {
    it('should return fields from configuration', () => {
      should(pluginsManager.getStrategyFields('someStrategy')).be.deepEqual(['aField', 'anotherField']);
    });
  });

  describe('#hasStrategyMethod', () => {
    it('should return true if a method exists', () => {
      should(pluginsManager.hasStrategyMethod('someStrategy', 'exists')).be.true();
    });

    it('should false true if a method does not exist', () => {
      should(pluginsManager.hasStrategyMethod('someStrategy', 'notExists')).be.false();
    });
  });

  describe('#getStrategyMethod', () => {
    it('should return a method', () => {
      should(pluginsManager.getStrategyMethod('someStrategy', 'exists')).be.a.Function();
    });
  });

  describe('#initAuthentication', () => {
    let
      initAuthentication,
      consoleMock;

    beforeEach(() => {
      consoleMock = {
        log: sandbox.stub(),
        warn: sandbox.stub(),
        error: sandbox.stub()
      };
      pluginsManager.authentications = {};
      initAuthentication = PluginsManager.__get__('initAuthentication');
      PluginsManager.__set__('console', consoleMock);
    });

    it('should add the strategy in authentications if the strategy is well defined', done => {
      let verifyAdapter;

      plugin.object.existsFunction = sandbox.stub().returns(foo);
      plugin.object.verifyFunction = sandbox.stub().returns(Promise.resolve({
        kuid: 'foo'
      }));

      initAuthentication(pluginsManager, plugin);
      should(pluginsManager.authentications.someStrategy.strategy).be.deepEqual(plugin.object.strategies.someStrategy);
      should(pluginsManager.authentications.someStrategy.methods.afterRegister).be.Function();
      should(plugin.object.afterRegisterFunction).be.calledOnce();
      should(plugin.object.afterRegisterFunction.firstCall.args[0]).be.instanceOf(plugin.object.strategies.someStrategy.config.constructor);
      should(pluginsManager.authentications.someStrategy.methods.exists).be.Function();
      should(pluginsManager.authentications.someStrategy.methods.create).be.Function();
      should(pluginsManager.authentications.someStrategy.methods.update).be.Function();
      should(pluginsManager.authentications.someStrategy.methods.delete).be.Function();
      should(pluginsManager.authentications.someStrategy.methods.getById).be.Function();
      should(pluginsManager.authentications.someStrategy.methods.getInfo).be.Function();
      should(pluginsManager.authentications.someStrategy.methods.validate).be.Function();
      should(plugin.object.strategies.someStrategy.config.constructor).be.calledOnce();
      should(plugin.object.strategies.someStrategy.config.constructor).be.calledWithNew();

      verifyAdapter = plugin.object.strategies.someStrategy.config.constructor.firstCall.args[1];

      pluginsManager.authentications.someStrategy.methods.exists(foo)
        .then(result => {
          should(result).be.deepEqual(foo);
          should(plugin.object.existsFunction).be.calledOnce();
          verifyAdapter({}, (error) => {
            if (error) {
              done(error);
            }
            else {
              done();
            }
          });
        });
    });

    it('method invocation should intercept a thrown error to transform it into PluginImplementationError', () => {
      plugin.object.existsFunction = sandbox.stub().throws(new Error('some error'));

      initAuthentication(pluginsManager, plugin);
      should(pluginsManager.authentications.someStrategy.strategy).be.deepEqual(plugin.object.strategies.someStrategy);
      should(pluginsManager.authentications.someStrategy.methods.exists).be.Function();
      should(pluginsManager.authentications.someStrategy.methods.create).be.Function();
      should(pluginsManager.authentications.someStrategy.methods.update).be.Function();
      should(pluginsManager.authentications.someStrategy.methods.delete).be.Function();
      should(pluginsManager.authentications.someStrategy.methods.getInfo).be.Function();
      should(pluginsManager.authentications.someStrategy.methods.validate).be.Function();

      return should(pluginsManager.authentications.someStrategy.methods.exists(foo)).be.rejectedWith(PluginImplementationError);
    });

    it('should print an error in the console if strategies is not an object', () => {
      plugin.object.strategies = {};

      should(() => initAuthentication(pluginsManager, plugin))
        .throw(/the plugin must provide an object "strategies"/i);
    });

    it('should print an error in the console if the strategy is not an object', () => {
      plugin.object.strategies.someStrategy = 'notAnObject';

      should(() => initAuthentication(pluginsManager, plugin))
        .throw(/the plugin must provide an object for strategy "someStrategy"/i);
    });

    it('should print an error in the console if methods are not specified', () => {
      plugin.object.strategies.someStrategy.methods = 'notAnObject';

      should(() => initAuthentication(pluginsManager, plugin))
        .throw(/the plugin must provide a "methods" object in strategies\['someStrategy'\] property/i);
    });

    it('should print an error in the console if config are not specified', () => {
      plugin.object.strategies.someStrategy.config = 'notAnObject';

      should(() => initAuthentication(pluginsManager, plugin))
        .throw(/he plugin must provide a "config" object in strategies\['someStrategy'\] property/i);
    });

    it('should print an error in the console if a mandatory method is not specified', () => {
      delete plugin.object.strategies.someStrategy.methods.exists;

      should(() => initAuthentication(pluginsManager, plugin))
        .throw(/the plugin must provide a method "exists" in strategy configuration/i);
    });

    it('should print an error in the console if a mandatory method is not available in the plugin object', () => {
      delete plugin.object.existsFunction;

      should(() => initAuthentication(pluginsManager, plugin))
        .throw(/the plugin property "existsFunction" must be a function/i);
    });

    it('should print an error in the console if the getInfo method is specified but the method is not available in the plugin object', () => {
      delete plugin.object.getInfoFunction;

      should(() => initAuthentication(pluginsManager, plugin))
        .throw(/the plugin property "getInfoFunction" must be a function/i);
    });

    it('should print an error in the console if the strategy constructor is not provided', () => {
      plugin.object.strategies.someStrategy.config.constructor = 'notAFunction';

      should(() => initAuthentication(pluginsManager, plugin))
        .throw(/the constructor of the strategy "someStrategy" must be a function/i);
    });

    it('should print an error in the console if the "strategyOptions" config is not provided', () => {
      delete plugin.object.strategies.someStrategy.config.strategyOptions;

      should(() => initAuthentication(pluginsManager, plugin))
        .throw(/the "strategyOptions" of the strategy "someStrategy" must be an object/i);
    });

    it('should print an error in the console if the "authenticateOptions" config is not provided', () => {
      delete plugin.object.strategies.someStrategy.config.authenticateOptions;

      should(() => initAuthentication(pluginsManager, plugin))
        .throw(/the "authenticateOptions" of the strategy "someStrategy" must be an object/i);
    });

    it('should print an error in the console if the "fields" config is not provided', () => {
      delete plugin.object.strategies.someStrategy.config.fields;

      should(() => initAuthentication(pluginsManager, plugin))
        .throw(/the "fields" of the strategy "someStrategy" must be an array/i);
    });
    it('should print an error in the console if the "verify" config is not provided', () => {
      delete plugin.object.strategies.someStrategy.methods.verify;

      should(() => initAuthentication(pluginsManager, plugin))
        .throw(/the plugin must provide a method "verify" in strategy configuration/i);
    });

    it('should print an error in the console if the "verify" method is not available in the plugin object', () => {
      delete plugin.object.verifyFunction;

      should(() => initAuthentication(pluginsManager, plugin))
        .throw(/the plugin property "verifyFunction" must be a function/i);
    });

    it('should throw an error if a strategy is registered twice', () => {
      initAuthentication(pluginsManager, plugin);

      should(() => initAuthentication(pluginsManager, plugin))
        .throw(/an authentication strategy "someStrategy" has already been registered/i);
    });
  });
});
