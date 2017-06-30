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
    plugin,
    pluginManagerStrategy,
    sandbox = sinon.sandbox.create(),
    foo = {foo: 'bar'};

  beforeEach(() => {
    kuzzle = new KuzzleMock();
    /** @type {PluginsManager} */
    pluginsManager = new PluginsManager(kuzzle);

    plugin = {
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
      strategy: plugin.strategies.someStrategy,
      methods: {
        exists: plugin.existsFunction,
        create: plugin.createFunction,
        update: plugin.updateFunction,
        delete: plugin.deleteFunction,
        getById: plugin.getByIdFunction,
        getInfo: plugin.getInfoFunction,
        validate: plugin.validateFunction,
        afterRegister: plugin.afterRegisterFunction
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

  describe('#injectAuthentication', () => {
    let
      authentications,
      injectAuthentication,
      consoleMock;
    const
      pluginName = 'some-plugin-name';

    beforeEach(() => {
      consoleMock = {
        log: sandbox.stub(),
        warn: sandbox.stub(),
        error: sandbox.stub()
      };
      authentications = {};
      injectAuthentication = PluginsManager.__get__('injectAuthentication');
      PluginsManager.__set__('console', consoleMock);
    });

    it('should add the strategy in authentications if the strategy is well defined', done => {
      let verifyAdapter;

      plugin.existsFunction = sandbox.stub().returns(foo);
      plugin.verifyFunction = sandbox.stub().returns(Promise.resolve({
        kuid: 'foo'
      }));

      should(injectAuthentication(kuzzle, authentications, plugin, pluginName)).be.true();
      should(authentications.someStrategy.strategy).be.deepEqual(plugin.strategies.someStrategy);
      should(authentications.someStrategy.methods.afterRegister).be.Function();
      should(plugin.afterRegisterFunction).be.calledOnce();
      should(plugin.afterRegisterFunction.firstCall.args[0]).be.instanceOf(plugin.strategies.someStrategy.config.constructor);
      should(authentications.someStrategy.methods.exists).be.Function();
      should(authentications.someStrategy.methods.create).be.Function();
      should(authentications.someStrategy.methods.update).be.Function();
      should(authentications.someStrategy.methods.delete).be.Function();
      should(authentications.someStrategy.methods.getById).be.Function();
      should(authentications.someStrategy.methods.getInfo).be.Function();
      should(authentications.someStrategy.methods.validate).be.Function();
      should(plugin.strategies.someStrategy.config.constructor).be.calledOnce();
      should(plugin.strategies.someStrategy.config.constructor).be.calledWithNew();

      verifyAdapter = plugin.strategies.someStrategy.config.constructor.firstCall.args[1];

      authentications.someStrategy.methods.exists(foo)
        .then(result => {
          should(result).be.deepEqual(foo);
          should(plugin.existsFunction).be.calledOnce();
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
      plugin.existsFunction = sandbox.stub().throws(new Error('some error'));

      should(injectAuthentication(kuzzle, authentications, plugin, pluginName)).be.true();
      should(authentications.someStrategy.strategy).be.deepEqual(plugin.strategies.someStrategy);
      should(authentications.someStrategy.methods.exists).be.Function();
      should(authentications.someStrategy.methods.create).be.Function();
      should(authentications.someStrategy.methods.update).be.Function();
      should(authentications.someStrategy.methods.delete).be.Function();
      should(authentications.someStrategy.methods.getInfo).be.Function();
      should(authentications.someStrategy.methods.validate).be.Function();

      return should(authentications.someStrategy.methods.exists(foo)).be.rejectedWith(PluginImplementationError);
    });

    it('should print an error in the console if strategies is not an object', () => {
      plugin.strategies = {};

      should(injectAuthentication(kuzzle, authentications, plugin, pluginName)).be.false();

      should(consoleMock.warn).be.calledOnce();
      should(consoleMock.warn.firstCall.args[0]).be.eql('\u001b[33m[!] [WARNING][Plugin Manager]: Unable to inject strategies from plugin "\u001b[1msome-plugin-name\u001b[22m": The plugin must provide an object "\u001b[1mstrategies\u001b[22m".\u001b[39m');
    });

    it('should print an error in the console if the strategy is not an object', () => {
      plugin.strategies.someStrategy = 'notAnObject';
      should(injectAuthentication(kuzzle, authentications, plugin, pluginName)).be.false();

      should(consoleMock.warn).be.calledOnce();
      should(consoleMock.warn.firstCall.args[0]).be.eql('\u001b[33m[!] [WARNING][Plugin Manager]: Unable to inject strategies from plugin "\u001b[1msome-plugin-name\u001b[22m": The plugin must provide an object for strategy "\u001b[1msomeStrategy\u001b[22m".\u001b[39m');
    });

    it('should print an error in the console if methods are not specified', () => {
      plugin.strategies.someStrategy.methods = 'notAnObject';

      should(injectAuthentication(kuzzle, authentications, plugin, pluginName)).be.false();

      should(consoleMock.warn).be.calledOnce();
      should(consoleMock.warn.firstCall.args[0]).be.eql('\u001b[33m[!] [WARNING][Plugin Manager]: Unable to inject strategies from plugin "\u001b[1msome-plugin-name\u001b[22m": The plugin must provide a "\u001b[1mmethods\u001b[22m" object in strategies[\'\u001b[1msomeStrategy\u001b[22m\'] property.\u001b[39m');
    });

    it('should print an error in the console if config are not specified', () => {
      plugin.strategies.someStrategy.config = 'notAnObject';

      should(injectAuthentication(kuzzle, authentications, plugin, pluginName)).be.false();

      should(consoleMock.warn).be.calledOnce();
      should(consoleMock.warn.firstCall.args[0]).be.eql('\u001b[33m[!] [WARNING][Plugin Manager]: Unable to inject strategies from plugin "\u001b[1msome-plugin-name\u001b[22m": The plugin must provide a "\u001b[1mconfig\u001b[22m" object in strategies[\'\u001b[1msomeStrategy\u001b[22m\'] property.\u001b[39m');
    });

    it('should print an error in the console if a mandatory method is not specified', () => {
      delete plugin.strategies.someStrategy.methods.exists;

      should(injectAuthentication(kuzzle, authentications, plugin, pluginName)).be.false();

      should(consoleMock.warn).be.calledOnce();
      should(consoleMock.warn.firstCall.args[0]).be.eql('\u001b[33m[!] [WARNING][Plugin Manager]: Unable to inject strategies from plugin "\u001b[1msome-plugin-name\u001b[22m": The plugin must provide a method "\u001b[1mexists\u001b[22m" in strategy configuration.\u001b[39m');
    });

    it('should print an error in the console if a mandatory method is not available in the plugin object', () => {
      delete plugin.existsFunction;

      should(injectAuthentication(kuzzle, authentications, plugin, pluginName)).be.false();

      should(consoleMock.warn).be.calledOnce();
      should(consoleMock.warn.firstCall.args[0]).be.eql('\u001b[33m[!] [WARNING][Plugin Manager]: Unable to inject strategies from plugin "\u001b[1msome-plugin-name\u001b[22m": The plugin property "\u001b[1mexistsFunction\u001b[22m" must be a function.\u001b[39m');
    });

    it('should print an error in the console if the getInfo method is specified but the method is not available in the plugin object', () => {
      delete plugin.getInfoFunction;

      should(injectAuthentication(kuzzle, authentications, plugin, pluginName)).be.false();

      should(consoleMock.warn).be.calledOnce();
      should(consoleMock.warn.firstCall.args[0]).be.eql('\u001b[33m[!] [WARNING][Plugin Manager]: Unable to inject strategies from plugin "\u001b[1msome-plugin-name\u001b[22m": The plugin property "\u001b[1mgetInfoFunction\u001b[22m" must be a function.\u001b[39m');
    });

    it('should print an error in the console if the strategy constructor is not provided', () => {
      plugin.strategies.someStrategy.config.constructor = 'notAFunction';

      should(injectAuthentication(kuzzle, authentications, plugin, pluginName)).be.false();

      should(consoleMock.warn).be.calledOnce();
      should(consoleMock.warn.firstCall.args[0]).be.eql('\u001b[33m[!] [WARNING][Plugin Manager]: Unable to inject strategies from plugin "\u001b[1msome-plugin-name\u001b[22m": The constructor of the strategy "\u001b[1msomeStrategy\u001b[22m" must be a function.\u001b[39m');
    });

    it('should print an error in the console if the "strategyOptions" config is not provided', () => {
      delete plugin.strategies.someStrategy.config.strategyOptions;

      should(injectAuthentication(kuzzle, authentications, plugin, pluginName)).be.false();

      should(consoleMock.warn).be.calledOnce();
      should(consoleMock.warn.firstCall.args[0]).be.eql('\u001b[33m[!] [WARNING][Plugin Manager]: Unable to inject strategies from plugin "\u001b[1msome-plugin-name\u001b[22m": The "\u001b[1mstrategyOptions\u001b[22m" of the strategy "\u001b[1msomeStrategy\u001b[22m" must be an object.\u001b[39m');
    });

    it('should print an error in the console if the "authenticateOptions" config is not provided', () => {
      delete plugin.strategies.someStrategy.config.authenticateOptions;

      should(injectAuthentication(kuzzle, authentications, plugin, pluginName)).be.false();

      should(consoleMock.warn).be.calledOnce();
      should(consoleMock.warn.firstCall.args[0]).be.eql('\u001b[33m[!] [WARNING][Plugin Manager]: Unable to inject strategies from plugin "\u001b[1msome-plugin-name\u001b[22m": The "\u001b[1mauthenticateOptions\u001b[22m" of the strategy "\u001b[1msomeStrategy\u001b[22m" must be an object.\u001b[39m');
    });

    it('should print an error in the console if the "fields" config is not provided', () => {
      delete plugin.strategies.someStrategy.config.fields;

      should(injectAuthentication(kuzzle, authentications, plugin, pluginName)).be.false();

      should(consoleMock.warn).be.calledOnce();
      should(consoleMock.warn.firstCall.args[0]).be.eql('\u001b[33m[!] [WARNING][Plugin Manager]: Unable to inject strategies from plugin "\u001b[1msome-plugin-name\u001b[22m": The "\u001b[1mfields\u001b[22m" of the strategy "\u001b[1msomeStrategy\u001b[22m" must be an array.\u001b[39m');
    });

    it('should print an error in the console if the "verify" config is not provided', () => {
      delete plugin.strategies.someStrategy.methods.verify;

      should(injectAuthentication(kuzzle, authentications, plugin, pluginName)).be.false();

      should(consoleMock.warn).be.calledOnce();
      should(consoleMock.warn.firstCall.args[0]).be.eql('\u001b[33m[!] [WARNING][Plugin Manager]: Unable to inject strategies from plugin "\u001b[1msome-plugin-name\u001b[22m": The plugin must provide a method "\u001b[1mverify\u001b[22m" in strategy configuration.\u001b[39m');
    });

    it('should print an error in the console if the "verify" method is not available in the plugin object', () => {
      delete plugin.verifyFunction;

      should(injectAuthentication(kuzzle, authentications, plugin, pluginName)).be.false();

      should(consoleMock.warn).be.calledOnce();
      should(consoleMock.warn.firstCall.args[0]).be.eql('\u001b[33m[!] [WARNING][Plugin Manager]: Unable to inject strategies from plugin "\u001b[1msome-plugin-name\u001b[22m": The plugin property "\u001b[1mverifyFunction\u001b[22m" must be a function.\u001b[39m');
    });

    it('should throw an error if a strategy is registered twice', () => {
      should(injectAuthentication(kuzzle, authentications, plugin, pluginName)).be.true();
      should(injectAuthentication(kuzzle, authentications, plugin, pluginName)).be.false();

      should(consoleMock.warn).be.calledOnce();
      should(consoleMock.warn.firstCall.args[0]).be.eql('\u001b[33m[!] [WARNING][Plugin Manager]: Unable to inject strategies from plugin "\u001b[1msome-plugin-name\u001b[22m": An authentication strategy "\u001b[1msomeStrategy\u001b[22m" has already been registered.\u001b[39m');
    });
  });
});
