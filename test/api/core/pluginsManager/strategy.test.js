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
    pluginsManager.plugins[plugin.name] = plugin;

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
      },
      owner: plugin.name
    };

    pluginsManager.strategies.someStrategy = pluginManagerStrategy;

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
      consoleMock;

    beforeEach(() => {
      consoleMock = {
        log: sandbox.stub(),
        warn: sandbox.stub(),
        error: sandbox.stub()
      };
      pluginsManager.strategies = {};
      PluginsManager.__set__('console', consoleMock);
    });

    it('should add the strategy in strategies if it is well-formed', done => {
      let verifyAdapter;

      plugin.object.existsFunction = sandbox.stub().returns(foo);
      plugin.object.verifyFunction = sandbox.stub().returns(Promise.resolve({kuid: 'foo'}));

      pluginsManager._initAuthentication(plugin);
      should(pluginsManager.strategies.someStrategy.strategy).be.deepEqual(plugin.object.strategies.someStrategy);
      should(pluginsManager.strategies.someStrategy.methods.afterRegister).be.Function();
      should(plugin.object.afterRegisterFunction).be.calledOnce();
      should(plugin.object.afterRegisterFunction.firstCall.args[0]).be.instanceOf(plugin.object.strategies.someStrategy.config.constructor);
      should(pluginsManager.strategies.someStrategy.methods.exists).be.Function();
      should(pluginsManager.strategies.someStrategy.methods.create).be.Function();
      should(pluginsManager.strategies.someStrategy.methods.update).be.Function();
      should(pluginsManager.strategies.someStrategy.methods.delete).be.Function();
      should(pluginsManager.strategies.someStrategy.methods.getById).be.Function();
      should(pluginsManager.strategies.someStrategy.methods.getInfo).be.Function();
      should(pluginsManager.strategies.someStrategy.methods.validate).be.Function();
      should(plugin.object.strategies.someStrategy.config.constructor).be.calledOnce();
      should(plugin.object.strategies.someStrategy.config.constructor).be.calledWithNew();

      verifyAdapter = plugin.object.strategies.someStrategy.config.constructor.firstCall.args[1];

      pluginsManager.strategies.someStrategy.methods.exists(foo)
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

      pluginsManager._initAuthentication(plugin);
      should(pluginsManager.strategies.someStrategy.strategy).be.deepEqual(plugin.object.strategies.someStrategy);
      should(pluginsManager.strategies.someStrategy.methods.exists).be.Function();
      should(pluginsManager.strategies.someStrategy.methods.create).be.Function();
      should(pluginsManager.strategies.someStrategy.methods.update).be.Function();
      should(pluginsManager.strategies.someStrategy.methods.delete).be.Function();
      should(pluginsManager.strategies.someStrategy.methods.getInfo).be.Function();
      should(pluginsManager.strategies.someStrategy.methods.validate).be.Function();

      return should(pluginsManager.strategies.someStrategy.methods.exists(foo)).be.rejectedWith(PluginImplementationError);
    });

    it('should print an error in the console if strategies is not an object', () => {
      plugin.object.strategies = {};

      should(() => pluginsManager._initAuthentication(plugin))
        .throw(/The exposed "strategies" plugin property must be a non-empty object/i);
    });

    it('should print an error in the console if the strategy is not an object', () => {
      plugin.object.strategies.someStrategy = 'notAnObject';

      should(() => pluginsManager._initAuthentication(plugin))
        .throw(/Invalid properties for strategy "someStrategy": must be an object/i);
    });

    it('should print an error in the console if methods are not specified', () => {
      plugin.object.strategies.someStrategy.methods = 'notAnObject';

      should(() => pluginsManager._initAuthentication(plugin))
        .throw(/"methods" object missing from the strategy 'someStrategy' properties/i);
    });

    it('should print an error in the console if config are not specified', () => {
      plugin.object.strategies.someStrategy.config = 'notAnObject';

      should(() => pluginsManager._initAuthentication(plugin))
        .throw(/"config" object missing from the strategy 'someStrategy' properties/i);
    });

    it('should print an error in the console if a mandatory method is not specified', () => {
      delete plugin.object.strategies.someStrategy.methods.exists;

      should(() => pluginsManager._initAuthentication(plugin))
        .throw(/Missing method "exists" in the strategy 'someStrategy' properties/i);
    });

    it('should print an error in the console if a mandatory method is not available in the plugin object', () => {
      ['exists', 'create', 'update', 'delete', 'validate', 'verify'].forEach(methodName => {
        const 
          fnName = methodName + 'Function',
          save = plugin.object[fnName];

        delete plugin.object[fnName];

        should(() => pluginsManager._initAuthentication(plugin))
          .throw(new RegExp(`The strategy method "${fnName}" must point to a plugin function`, 'i'));

        plugin.object[fnName] = save;
      });
    });

    it('should print an error in the console if an optional method is specified but does not point to a function', () => {
      delete plugin.object.getInfoFunction;

      should(() => pluginsManager._initAuthentication(plugin))
        .throw(/The strategy method "getInfoFunction" must be a function/i);
    });

    it('should print an error in the console if the strategy constructor is not provided', () => {
      plugin.object.strategies.someStrategy.config.constructor = 'notAFunction';

      should(() => pluginsManager._initAuthentication(plugin))
        .throw(/The constructor of the strategy "someStrategy" must be a function/i);
    });

    it('should print an error in the console if the "strategyOptions" config is not provided', () => {
      delete plugin.object.strategies.someStrategy.config.strategyOptions;

      should(() => pluginsManager._initAuthentication(plugin))
        .throw(/the "strategyOptions" object of the strategy "someStrategy" must be an object/i);
    });

    it('should print an error in the console if the "authenticateOptions" config is not provided', () => {
      delete plugin.object.strategies.someStrategy.config.authenticateOptions;

      should(() => pluginsManager._initAuthentication(plugin))
        .throw(/the "authenticateOptions" object of the strategy "someStrategy" must be an object/i);
    });

    it('should print an error in the console if the "fields" config is not provided', () => {
      delete plugin.object.strategies.someStrategy.config.fields;

      should(() => pluginsManager._initAuthentication(plugin))
        .throw(/the "fields" property of the strategy "someStrategy" must be an array/i);
    });

    it('should throw an error if a strategy is registered twice', () => {
      pluginsManager._initAuthentication(plugin);

      should(() => pluginsManager._initAuthentication(plugin))
        .throw(/an authentication strategy "someStrategy" has already been registered/i);
    });
  });

  describe('#unregisterStrategy', () => {
    it('should remove a strategy using its provided name', () => {
      pluginsManager.unregisterStrategy(plugin.name, 'someStrategy');
      should(pluginsManager.strategies).be.an.Object().and.be.empty();
      should(kuzzle.passport.unuse).calledWith('someStrategy');
    });

    it('should throw if the strategy does not exist', () => {
      should(() => pluginsManager.unregisterStrategy(plugin.name, 'foobar'))
        .throw(/Cannot remove strategy foobar: strategy does not exist/i);
    });

    it('should throw if not the owner of the strategy', () => {
      should(() => pluginsManager.unregisterStrategy('Frank William Abagnale Jr.', 'someStrategy'))
        .throw(/Cannot remove strategy someStrategy: owned by another plugin/i);
    });
  });
});
